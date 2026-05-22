# ADR-0016: MCP tools as first-class providers

## TL;DR

When the backend is an integration target for external AI agents, expose capabilities via an MCP server (`@rekog/mcp-nest`). Each tool is one `@Injectable()` class with a single `@Tool({ name, description, parameters: zodSchema })` method. Tools live alongside the bounded-context code that owns the capability, validate inputs with **Zod** (not class-validator), and enforce per-call authorization against the authenticated user. External AI agents authenticate via OAuth like any other integration; no parallel identity model.

**Status:** Accepted
**Date:** 2026-05-11
**Applies to:** projects that expose AI capabilities via MCP

## Context

External AI agents (Claude Code, Cursor, Claude Desktop, custom agents) speak the Model Context Protocol. To expose backend capabilities to them in a typed, discoverable way, we need an MCP server that:

- Lives inside the existing NestJS process (one deployable, shared auth, shared DB).
- Discovers tools through standard Nest DI rather than ad-hoc registration.
- Validates tool parameters with a schema that is JSON-Schema-compatible (MCP's wire format).
- Authorizes each call against the authenticated user (the same identity model the rest of the API uses).
- Colocates each tool with the bounded-context code it exercises, not in a central `mcp/` folder.

External AI agents authenticate the same way any other external integration authenticates — via the OAuth flow exposed by the integration domain (ADR-0013). An "AI agent" calling MCP is just an OAuth client acting on behalf of a user; it does not get its own identity type. This keeps the authorization model unified and lets every existing `@Roles()`, `@CurrentUser()`, and resource-scope check apply unchanged.

`class-validator` decorators do not round-trip to JSON Schema cleanly; **Zod** does. So MCP parameter schemas use Zod even though HTTP DTOs (ADR-0007) continue to use class-validator.

## Decision

**Server wiring (`apps/api/src/app/app.module.ts`):**

```ts
McpModule.forRoot({
  name: '<project>',
  version: '1.0.0',
  description: '<one-line description of the MCP server>',
  transport: McpTransportType.STREAMABLE_HTTP,
}),
```

**Tool registration (per-domain module):**

```ts
@Module({
  imports: [
    McpModule.forFeature(
      [GetItemTool, SetItemTool, ListItemsTool, CreateItemTool, DeleteItemTool],
      '<project>', // must match McpModule.forRoot({ name })
    ),
  ],
  providers: [/* the tool classes are also providers */],
})
export class ApiItemModule {}
```

**Tool shape (canonical):**

```ts
const updateItemSchema = z.object({
  workspaceId: z.string().min(1),
  itemId: z.string().min(1),
  fields: z.record(z.string(), z.string())
    .refine((v) => Object.keys(v).length > 0, { message: 'fields must contain at least one entry' }),
  reason: z.string().max(500).optional(),
});

@Injectable()
export class UpdateItemTool {
  private readonly logger = new Logger(UpdateItemTool.name);
  constructor(
    private readonly itemService: ItemService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Tool({
    name: 'update_item',
    description: 'Update one or more fields on an Item. Returns the updated Item.',
    parameters: updateItemSchema,
  })
  async execute(
    params: z.infer<typeof updateItemSchema>,
    _context: unknown,
    req: { user?: AuthenticatedUser },
  ) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    await this.workspaceAccess.assertCanEdit(user.userId, params.workspaceId);
    return this.itemService.update(params.itemId, params.fields, user, params.reason);
  }
}
```

**Rules:**

- **One tool, one file, one class.** File naming: `<tool-name>.tool.ts` colocated under `libs/<area>/<context>/src/lib/mcp/`.
- **Parameter schema is Zod.** Co-located with the tool class as a top-level `const`; the type is reused for the method signature via `z.infer`.
- **Per-call authorization.** The authenticated user is on `req.user` (set by the standard `MainAuthGuard` — ADR-0013). Every tool that touches scoped resources MUST verify the user has the appropriate access to the requested resource (workspace, project, organization, etc.) before delegating.
- **Tools call services.** A tool is a thin adapter; business logic stays in the underlying service. The same service is used by REST controllers, by the in-UI AI agent (ADR-0017), and by MCP tools — one source of truth.
- **Tool descriptions are part of the contract.** The `description` and parameter `.describe()` strings ship to client agents. Treat them like API docs.
- **Naming.** Tool names are snake_case verbs: `update_item`, `list_items`, `create_item`. They appear directly in agent tool lists.

**MCP authentication:**

- Bearer token on `Authorization: Bearer ...` — the same OAuth access token / session token used everywhere else.
- The standard `MainAuthGuard` resolves the user (ADR-0013); the user lands on `req.user` and is accessible via the third argument of the tool's `execute(params, _ctx, req)`.
- External AI agents are OAuth clients. They go through the same authorization-code flow as any third-party integration, get an access token scoped to the user's grants, and use it on every call. There is no parallel identity model for "AI agents".

**Versioning:**

- Breaking changes to a tool's parameters require a new tool name (e.g., `update_item_v2`) and a deprecation note in the old tool's description. Do not silently change schemas — external agents have cached your tool surface.

## Consequences

**Accept:**

- The tool catalog is the AI integration contract; it lives next to the code that owns each capability.
- Tools and HTTP controllers share services. Adding an MCP surface to an existing capability is a 30-line file, not a refactor.
- Zod gives JSON-Schema-clean tool descriptions for free.
- Per-call authz is explicit per tool; reviewers can spot a missing resource-scope check at a glance.

**Live with:**

- Two validation libraries (class-validator for HTTP DTOs, Zod for MCP + AI SDK tools). The split is principled but real.
- `forbidNonWhitelisted` on the global `ValidationPipe` would 400 the assistant-ui chat payload (it sends extras beyond `messages`). Either loosen the global pipe or override per-controller for the chat endpoint: `@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))`.
- Tool descriptions and parameter `.describe()` strings are versioned API surface. Treat them with the same care as schema types.
- Every tool must remember the per-call authz check; a missing check is a security regression. Consider a small helper (`assertWorkspaceAccess(user, params.workspaceId)`) once you have more than a handful of tools.
