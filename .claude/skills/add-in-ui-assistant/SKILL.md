---
name: add-in-ui-assistant
description: Use when the user asks to "add an in-product AI chat", "wire assistant-ui", "add a chat sidebar", "set up the AI assistant", "stream chat with tools", or mentions the Vercel AI SDK + assistant-ui combo. Wires AgentService + AgentController on the backend and AssistantChatTransport + Thread on the frontend.
---

# add-in-ui-assistant

Add the in-product AI chat: assistant-ui on the frontend, Vercel AI SDK `streamText` on the backend, tools defined inline that call the same services as REST/MCP. The assistant runs in the user's session — same auth, same permissions, no separate identity.

## When to use

- The product needs a chat sidebar / assistant bar where users talk to an AI that can read and modify product data.
- The backend already has the relevant services; the assistant should orchestrate them.
- The use case is "chat with tools," not a long-running graph-based agent (use LangChain/LangGraph for those — see ADR-0017's comparison table).

## Inputs to confirm

1. **Endpoint route** — typical: `/api/workspaces/:workspaceId/chat` or `/api/<resource>/:id/chat`.
2. **Tools** — which services the assistant should be able to call. Reuse existing services; don't fork.
3. **Model** — Anthropic Claude via `@ai-sdk/anthropic` is the default.
4. **Where the chat UI lives** — typically `libs/shared/client/ui/src/components/chat-sidebar/chat-sidebar.tsx`.

## Steps

### Backend

1. **Add config** in `apps/api/src/app/configuration.ts`:

   ```ts
   anthropic: z.object({
     apiKey: z.string(),
     model: z.string(),
   }),
   ```

2. **Create `AgentService`** in the owning bounded context (the context whose data the assistant manipulates):

   ```ts
   import { Injectable, Logger } from '@nestjs/common';
   import { ConfigService } from '@nestjs/config';
   import { createAnthropic, AnthropicProvider } from '@ai-sdk/anthropic';
   import { convertToModelMessages, stepCountIs, streamText, StreamTextResult, tool, ToolSet, UIMessage } from 'ai';
   import { z } from 'zod';
   import { AuthenticatedUser } from '@<project>/core-common';
   import { <Context>Service } from './<context>.service';

   const MAX_STEPS = 8;

   export interface AgentChatInput {
     resourceId: string;
     user: AuthenticatedUser;
     messages: UIMessage[];
   }

   @Injectable()
   export class AgentService {
     private readonly logger = new Logger(AgentService.name);
     private readonly anthropic: AnthropicProvider;
     private readonly modelId: string;

     constructor(
       configService: ConfigService,
       private readonly contextService: <Context>Service,
     ) {
       this.anthropic = createAnthropic({ apiKey: configService.getOrThrow('anthropic.apiKey') });
       this.modelId = configService.getOrThrow('anthropic.model');
     }

     async chat(input: AgentChatInput): Promise<StreamTextResult<ToolSet, never>> {
       const tools = this.buildTools(input.resourceId, input.user);
       return streamText({
         model: this.anthropic(this.modelId),
         system: this.buildSystemPrompt(input.resourceId),
         messages: await convertToModelMessages(input.messages),
         tools,
         stopWhen: stepCountIs(MAX_STEPS),
       });
     }

     private buildSystemPrompt(resourceId: string): string {
       return `You are an AI assistant operating within ${resourceId}.

   Available tools: read_items, update_item. Use them when the user asks you to inspect or modify data.
   Always include a brief reason when modifying data — it will be surfaced in the audit log.`;
     }

     private buildTools(resourceId: string, user: AuthenticatedUser): ToolSet {
       return {
         read_items: tool({
           description: 'Read items in the current resource.',
           inputSchema: z.object({}),
           execute: async () => this.contextService.list(resourceId, user),
         }),
         update_item: tool({
           description: 'Update fields on an item. Reason is surfaced in the audit log.',
           inputSchema: z.object({
             itemId: z.string(),
             fields: z.record(z.string(), z.string()),
             reason: z.string().min(1).max(500),
           }),
           execute: async ({ itemId, fields, reason }) =>
             this.contextService.update(itemId, fields, user, { reason, source: 'assistant' }),
         }),
       };
     }
   }
   ```

3. **Create `AgentController`**:

   ```ts
   @Controller({ version: VERSION_NEUTRAL, path: 'workspaces/:resourceId/chat' })
   export class AgentController {
     constructor(private readonly agentService: AgentService) {}

     // assistant-ui posts extras beyond `messages`; override the global pipe
     // for this route to strip-and-continue instead of 400-ing.
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

4. **DTO**:

   ```ts
   export class ChatRequestDto {
     @IsArray() messages!: UIMessage[];
   }
   ```

5. **Wire into the module** — add `AgentService` to providers, `AgentController` to controllers.

### Frontend

6. **Create the chat sidebar component** in `libs/shared/client/ui/src/components/chat-sidebar/chat-sidebar.tsx`:

   ```tsx
   'use client';
   import { useMemo } from 'react';
   import { AssistantRuntimeProvider } from '@assistant-ui/react';
   import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
   import { Thread } from '../assistant-ui/thread';

   export function ChatSidebar({ resourceId, getToken }: { resourceId: string; getToken: () => Promise<string | null> }) {
     const transport = useMemo(
       () =>
         new AssistantChatTransport({
           api: `/api/nest/workspaces/${resourceId}/chat`,
           fetch: async (input, init) => {
             const token = await getToken();
             const headers = new Headers(init?.headers);
             if (token) headers.set('Authorization', `Bearer ${token}`);
             return fetch(input, { ...init, headers });
           },
         }),
       [resourceId, getToken],
     );

     const runtime = useChatRuntime({ transport });
     return (
       <AssistantRuntimeProvider runtime={runtime}>
         <Thread />
       </AssistantRuntimeProvider>
     );
   }
   ```

7. **Add the `assistant-ui` components** (Thread, message components, tool fallbacks). Use the `assistant-ui` skill from `@assistant-ui/skills` if installed, or copy them from a previous project.

8. **Configure the Next.js proxy route** (`apps/ui/src/app/api/nest/[...path]/route.ts`) so `/api/nest/...` forwards to the NestJS backend.

## Rules

- **DO** run the assistant in the user's session. Tools receive the authenticated user and call services with that user.
- **DO** use the same service methods that REST/MCP use. One write path, one operation-log entry.
- **DO** override the global ValidationPipe per chat controller (`whitelist: true, transform: true` without `forbidNonWhitelisted`).
- **DO** cap tool loops with `stopWhen: stepCountIs(MAX_STEPS)`.
- **DO** make the system prompt context-aware (the current workspace/project/etc. ID is in scope).
- **DON'T** create a separate "assistant" identity. The user IS the actor; if the audit log needs to distinguish, pass `source: 'assistant'` as service metadata.
- **DON'T** define tool logic inline that bypasses the service. Always delegate.
- **DON'T** loosen the global ValidationPipe to support assistant-ui — override per-controller.

## References

- ADR-0017: In-UI AI chat with assistant-ui + Vercel AI SDK v6
- ADR-0016: MCP tools (the external counterpart)
- ADR-0013: Auth (the user identity the assistant inherits)
