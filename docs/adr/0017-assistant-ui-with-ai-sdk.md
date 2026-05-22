# ADR-0017: In-UI AI chat with assistant-ui + Vercel AI SDK v6

## TL;DR

The in-UI assistant is `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` on the frontend talking to a NestJS controller that calls `streamText` from the **Vercel AI SDK v6** (`ai`, `@ai-sdk/anthropic`). Tools are defined inline with `tool({ inputSchema: zodSchema, execute })` and call the same services that back the REST/MCP surfaces. The assistant runs in the user's session — same auth, same access checks, no separate identity. This is distinct from the external MCP surface (ADR-0016): the in-UI path is direct and bypasses the MCP hop.

**Status:** Accepted
**Date:** 2026-05-11
**Applies to:** projects with an in-product AI chat

## Context

There are two distinct AI integration paths in an AI-native app:

1. **External agents** that bring their own model and call the MCP server using OAuth (ADR-0016).
2. **In-product chat** that lives in the UI alongside the data, where the user is the authenticated principal and the AI is the product's own assistant — we choose the model, the prompt, the tools, and the streaming response shape.

Both paths must write through the same services so authorization, validation, audit logging, and side effects are identical. The difference is in transport and where the model lives.

For graph-based agents with branching, persistent state, or complex routing, **LangChain/LangGraph** remains the right tool. For "tools + system prompt + streaming chat", the **Vercel AI SDK** is the right tool:

- `streamText` is a single-call streaming primitive with first-class tool calls.
- `assistant-ui` provides composable React components and runtime hooks (`useChatRuntime`, `AssistantRuntimeProvider`, `Thread`) that consume the AI SDK stream natively via `@assistant-ui/react-ai-sdk`.
- Tool definitions are colocated with the agent service; no separate graph definition file, no separate registry.
- The result: the entire in-UI AI surface is ~150 lines of backend code plus a couple of React components.

## Decision

**Frontend (in a shared client lib):**

```tsx
'use client';
import { AssistantRuntimeProvider, useAuiState } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { Thread } from '../assistant-ui/thread';

export function ChatSidebar({ resourceId }: { resourceId: string }) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: `/api/nest/resources/${resourceId}/chat`,
        fetch: async (input, init) => {
          const token = await getAccessToken(); // session JWT / OAuth token
          const headers = new Headers(init?.headers);
          if (token) headers.set('Authorization', `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
      }),
    [resourceId],
  );

  const runtime = useChatRuntime({ transport });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

Notes on the transport:
- `api` points at a Next.js proxy route (`/api/nest/...`) that forwards to the NestJS controller. The proxy keeps auth cookies in scope and avoids CORS on the direct call. In production a direct API URL can be used.
- The custom `fetch` attaches `Authorization: Bearer <token>` so the backend `MainAuthGuard` can resolve the user.

**Backend controller (NestJS):**

```ts
@Controller({ version: VERSION_NEUTRAL, path: 'resources/:resourceId/chat' })
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // The AI SDK / assistant-ui client posts extra top-level fields beyond
  // `messages`. The global pipe's forbidNonWhitelisted would 400 those out;
  // we strip them silently instead.
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async chat(
    @Param('resourceId') resourceId: string,
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.agentService.chat({ resourceId, user, messages: dto.messages });
    result.pipeUIMessageStreamToResponse(res);
  }
}
```

**Backend service (`AgentService`):**

```ts
@Injectable()
export class AgentService {
  private readonly anthropic = createAnthropic({
    apiKey: this.configService.getOrThrow('anthropic.apiKey'),
  });
  private readonly modelId = this.configService.getOrThrow('anthropic.model');

  constructor(
    private readonly configService: ConfigService,
    private readonly itemService: ItemService,
  ) {}

  async chat({ resourceId, user, messages }: AgentChatInput): Promise<StreamTextResult<ToolSet, never>> {
    const tools = this.buildTools(resourceId, user);
    return streamText({
      model: this.anthropic(this.modelId),
      system: buildSystemPrompt(resourceId),
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });
  }

  private buildTools(resourceId: string, user: AuthenticatedUser): ToolSet {
    return {
      read_items: tool({
        description: 'Read items in the current resource.',
        inputSchema: z.object({}),
        execute: async () => this.itemService.list(resourceId, user),
      }),
      update_item: tool({
        description: 'Update fields on an item. Reason is surfaced in the audit log.',
        inputSchema: z.object({
          itemId: z.string(),
          fields: z.record(z.string(), z.string()).describe('Fields to update.'),
          reason: z.string().min(1).max(500).describe('Brief explanation, surfaced in the audit log.'),
        }),
        execute: async ({ itemId, fields, reason }) =>
          this.itemService.update(itemId, fields, user, { reason, source: 'assistant' }),
      }),
    };
  }
}
```

**Rules:**

- **The assistant runs in the user's session.** Tools receive the authenticated `user` and call services with that user as the caller. No separate identity for the assistant.
- **Tools call services, not the database.** The same `ItemService.update(...)` powers HTTP, MCP, and in-UI tool calls — one code path, one audit log entry per write regardless of surface.
- **Audit attribution.** If the audit log needs to distinguish a write triggered by the assistant from a direct user write, pass a `source: 'assistant' | 'user'` flag into the service. The identity is the user; the source is metadata.
- **System prompt is a function of the context** (resourceId, the resource's name, etc.). It enumerates the available tools and states the value/format conventions explicitly so the model doesn't have to infer.
- **`stopWhen: stepCountIs(MAX_STEPS)`** caps tool-calling loops; 8 is a reasonable starting point.
- **Streaming.** `pipeUIMessageStreamToResponse(res)` writes the AI SDK's UI-message-stream format; `assistant-ui` consumes it natively.
- **Pipe override per controller.** The global `ValidationPipe` rejects unknown fields; assistant-ui posts extras (`id`, `trigger`, `tools`, `metadata`). The chat controller declares its own `@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))` — strip and continue, never 400.

**When to use this vs LangChain:**

| Surface | Use Vercel AI SDK | Use LangChain/LangGraph |
|---|---|---|
| In-product chat with a handful of tools | ✔ | |
| Persistent multi-step agent state, checkpoints, time travel | | ✔ |
| Streaming a single chat reply with tool calls | ✔ | |
| Graph-based agent with branching, memory, complex routing | | ✔ |
| Want the assistant-ui frontend with native runtime | ✔ | (possible via custom runtime) |

## Consequences

**Accept:**

- The in-UI agent is small, readable code with no separate graph file.
- Tool definitions and the system prompt live in one place; reviewers can audit the AI's capabilities by reading one file.
- The assistant has exactly the user's permissions — no privilege escalation, no parallel identity.
- Frontend integration is a transport, a runtime, and a `Thread` component. No bespoke chat state machine.
- Streaming, retries, and tool calling are AI-SDK responsibilities, not ours.

**Live with:**

- Two AI surfaces (in-UI direct, external MCP) means tool surface drift between them is possible. Keep tool names aligned where they share semantics; diverge only when the in-UI tool genuinely needs a different shape.
- AI SDK v6 changed APIs from v5 (e.g., `generateObject` was deprecated in favor of `generateText({ output })`). Pin the version and read upgrade notes when bumping.
- The chat controller's per-route pipe override is a one-off; document why so future contributors don't "fix" it back to the strict global.
- LangChain remains the right answer when state, branching, or replay is the point; don't migrate working LangGraph agents to AI SDK reflexively.
