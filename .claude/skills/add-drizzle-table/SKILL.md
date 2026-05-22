---
name: add-drizzle-table
description: Use when the user asks to "add a table", "add a column", "create a migration", "update the schema", "drizzle table", or describes a new persistent entity. Adds a table definition to the Drizzle schema, generates a migration, and verifies it.
---

# add-drizzle-table

Add a new Drizzle table (or column) to the schema and generate the corresponding migration.

## When to use

- A new domain entity needs persistence.
- An existing table needs a new column, index, or foreign key.
- The user mentions "schema", "migration", or "drizzle" in a write context.

## Inputs to confirm

1. **Table name** (camelCase TS, snake_case in SQL — Drizzle handles the mapping).
2. **Owning bounded context** — most tables live in the core schema; some contexts may own their own sub-schema.
3. **Columns** with types and constraints (nullable? default? foreign key?).
4. **Indexes** — anything that will be queried on without the primary key.

## Steps

1. **Add the table to `libs/core/common/src/lib/db/schema.ts`**:

   ```ts
   import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';

   export const invoice = pgTable('invoice', {
     id: uuid('id').primaryKey(),
     workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
     amountCents: integer('amount_cents').notNull(),
     status: text('status').notNull(),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
   });
   ```

2. **Verify the barrel re-export** — `libs/core/common/src/index.ts` already exports the schema; the new table is picked up automatically.

3. **Generate the migration**:

   ```bash
   pnpm nx run core:migrate-generate
   # or, depending on project: pnpm nx run api:migrate-generate
   ```

   This creates a new SQL file under `apps/core/migrations/` (or `apps/api/migrations/`) with a numeric prefix and a metadata entry.

4. **Review the generated SQL.** Open the new migration file and check:

   - The DDL matches what you intended.
   - Foreign keys are present.
   - Indexes are created (Drizzle generates them from `.index()` modifiers on the column).
   - No accidental column drops or renames that you didn't intend.

5. **Apply locally**:

   ```bash
   pnpm nx run core:migrate-push   # dev convenience: pushes schema directly
   # or, for the migration-file workflow:
   pnpm nx run core:migrate-run
   ```

6. **Commit both** the schema change AND the generated migration file in the same commit.

## Adding a column

Same flow: edit the existing `pgTable` definition, regenerate the migration, review, apply.

For nullable-then-backfill-then-not-null on a large table, add the column as nullable in one migration, backfill in code/SQL, then add a `NOT NULL` constraint in a follow-up migration.

## Adding an index

```ts
export const invoice = pgTable(
  'invoice',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    // ...
  },
  (table) => ({
    workspaceIdIdx: index('invoice_workspace_id_idx').on(table.workspaceId),
  }),
);
```

## Rules

- **DO** review generated SQL before applying. Drizzle is usually right, but check.
- **DO** commit schema + migration in one PR.
- **DO** update `.env.example` if the change requires a new env var (rare, but happens for read replicas).
- **DON'T** edit a migration that's already in main. Add a new one.
- **DON'T** use `migrate-push` in production. It's for dev only. Production uses `migrate-run` on numbered migration files.
- **DON'T** add `NOT NULL` to an existing column on a large table without a backfill plan.

## References

- ADR-0006: Drizzle ORM with Postgres
