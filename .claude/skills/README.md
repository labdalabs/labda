# Skills

Project-scoped Claude Code skills derived from the ADRs and AGENTS.md in this repo. Each skill is a self-contained recipe — invoke as `/<skill-name>` or let Claude pick it up automatically based on the description.

## Scaffolding

| Skill | Use when |
|---|---|
| [`bootstrap-from-template`](./bootstrap-from-template/SKILL.md) | Starting a new project from this template (one-time per project) |
| [`scaffold-bounded-context`](./scaffold-bounded-context/SKILL.md) | Adding a new domain module / bounded context to the backend |

## Backend recipes

| Skill | Use when |
|---|---|
| [`add-graphql-operation`](./add-graphql-operation/SKILL.md) | Adding a GraphQL query / mutation / subscription / resolved field |
| [`add-rest-endpoint`](./add-rest-endpoint/SKILL.md) | Adding a REST controller — OAuth callback, webhook, file upload, redirect |
| [`add-drizzle-table`](./add-drizzle-table/SKILL.md) | Adding a Drizzle table + generating a migration |
| [`add-domain-event`](./add-domain-event/SKILL.md) | Adding a new `DomainEvent<T>` for cross-context async communication |
| [`add-queue-consumer`](./add-queue-consumer/SKILL.md) | Adding a queue handler for a bounded context |
| [`add-saga`](./add-saga/SKILL.md) | Modeling a multi-step workflow with state, compensation, and timeouts |

## AI surfaces

| Skill | Use when |
|---|---|
| [`add-mcp-tool`](./add-mcp-tool/SKILL.md) | Exposing a capability to external AI agents via MCP |
| [`add-in-ui-assistant`](./add-in-ui-assistant/SKILL.md) | Wiring the in-product AI chat (assistant-ui + Vercel AI SDK) |

## Supabase variant

| Skill | Use when |
|---|---|
| [`use-supabase-auth`](./use-supabase-auth/SKILL.md) | Switching auth from Passport+OTP to Supabase Auth + JWT verification |
| [`use-supabase-storage`](./use-supabase-storage/SKILL.md) | Adding file uploads / serving assets via Supabase Storage (with RLS) |
| [`use-supabase-queues`](./use-supabase-queues/SKILL.md) | Using pgmq + pg_cron as a Postgres-native queue + scheduler |

## Governance

| Skill | Use when |
|---|---|
| [`architecture-review`](./architecture-review/SKILL.md) | Auditing changes against all 18 ADRs |
| [`update-context-md`](./update-context-md/SKILL.md) | Adding / refining a term in the Ubiquitous Language glossary |

---

When seeding a new project, copy the entire `.claude/skills/` directory into the new repo so these are available there too. The `bootstrap-from-template` skill does this as part of its steps.

## Skill format

Every skill is a Claude Code `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name
description: One-line description with trigger phrases
---

# Body...
```

The `description` is what Claude uses to decide when to invoke the skill automatically — it lists the trigger phrases the user is likely to say.

## Adding a new skill

1. Create `<skill-name>/SKILL.md` in this directory.
2. Front-load the description with trigger phrases.
3. Structure the body as: "When to use" → "Inputs to confirm" → "Steps" → "Rules" → "References".
4. Reference the relevant ADR(s) so the "why" is one click away.
5. Add a row to the right table above.
