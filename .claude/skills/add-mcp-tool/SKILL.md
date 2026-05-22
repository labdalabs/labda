---
name: add-mcp-tool
description: Use when the user asks to "add an MCP tool", "expose a capability to AI agents", "wire a new @Tool", "let external agents call X", or mentions Claude Code / Cursor calling into the backend. Creates a single-class @Tool with a Zod parameter schema and per-call user authorization.
---

# add-mcp-tool

Expose a backend capability to external AI agents via the MCP server. Each tool is one `@Injectable()` class with a single `@Tool()` method, validated by Zod, authorized per-call against the authenticated user.

## When to use

- The user wants Claude Code / Cursor / Claude Desktop / any MCP client to call a backend capability.
- A new operation needs to be exposed alongside existing MCP tools.
- An existing REST/HTTP capability should also be reachable from external AI agents.

## Inputs to confirm

1. **Tool name** in `snake_case`, verb form (`update_item`, `list_workspaces`, `create_invoice`).
2. **Owning bounded context** — the lib that will host the tool file.
3. **Parameters** — the Zod schema for inputs.
4. **Authorization scope** — what resource the user must have access to (workspace, project, organization, ...).
5. **Service method** the tool will call. If it doesn't exist yet, add it first (don't put business logic in the tool).

## Steps

1. **Create the tool file** at `libs/<area>/<context>/src/lib/mcp/<tool-name>.tool.ts`:

   ```ts
   import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
   import { Tool } from '@rekog/mcp-nest';
   import { z } from 'zod';
   import { AuthenticatedUser } from '@<project>/core-common';
   import { <Context>Service } from '../<context>.service';
   import { WorkspaceAccessService } from '@<project>/core-auth';

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
       private readonly itemService: <Context>Service,
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

2. **Register the tool** in the owning module via `McpModule.forFeature`. The server name must match `McpModule.forRoot({ name })` in `app.module.ts`:

   ```ts
   @Module({
     imports: [
       McpModule.forFeature([UpdateItemTool, /* other tools */], '<project>'),
     ],
     providers: [
       UpdateItemTool, // also a regular provider
       // ...
     ],
   })
   export class ApiItemModule {}
   ```

3. **Verify** by hitting the MCP endpoint and listing tools:

   ```bash
   # Inside Claude Code:
   claude mcp add --transport http <project> http://localhost:3001/api/mcp \
     --header "Authorization: Bearer <user-token>"
   claude mcp list
   ```

   The new tool should appear with its description and parameter schema.

## Rules

- **DO** name tools as `snake_case` verbs.
- **DO** define the Zod schema as a top-level `const`; reuse the type via `z.infer<typeof schema>`.
- **DO** verify per-call authorization. Every tool that touches scoped resources MUST check the user has access.
- **DO** treat the `description` and parameter `.describe()` strings as public API contract; write them like docs.
- **DO** delegate to a service. The tool is a thin adapter.
- **DON'T** put business logic in the tool. Move it into the service so HTTP/MCP/AI-SDK paths share one source of truth.
- **DON'T** introduce parallel identity models for "AI agents". External agents authenticate via OAuth like any other integration.
- **DON'T** mutate an existing tool's schema in a breaking way — create `update_item_v2` and deprecate the old one.

## Auth note

The authenticated user is on `req.user` (set by the standard `MainAuthGuard`). External AI agents are OAuth clients acting on behalf of a user; the auth chain is identical to any other API call. Do not introduce `Actor` / `agent` types or workbook-scoped API keys — OAuth is the only model.

## Operation log / audit

If the underlying service writes data, ensure its operation-log entry attributes the write to the user. If the call came from an in-UI assistant rather than directly, pass `source: 'assistant' | 'user'` as a metadata flag to the service — the identity stays the same; the source is just metadata. (See `add-in-ui-assistant`.)

## References

- ADR-0016: MCP tools as first-class providers
- ADR-0013: Session-based auth (the auth model the tool consumes)
- ADR-0007: GraphQL-first API (the wider validation context)
