import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// Embedding dimensionality for Reference vectors. Matches the local hashing
// EmbeddingService in libs/core/research. Change both together.
export const REFERENCE_EMBEDDING_DIM = 384;

// Example schema. Replace with your domain tables.
//
// With Supabase Auth, the `auth.users` table is managed by Supabase. App-specific
// user fields live in this `Profile` table, mirrored from `auth.users` by trigger
// or RLS-aware insert. See `use-supabase-auth` skill for the wiring.

export const userRole = pgEnum('UserRole', ['admin', 'member', 'viewer']);

export const profile = pgTable('Profile', {
  // Matches auth.users.id (uuid) from Supabase Auth.
  id: text().primaryKey().notNull(),
  email: text().notNull(),
  fullName: text(),
  role: userRole().default('member').notNull(),
  createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
});

// ─── research context (CONTEXT.md: Project / Hypothesis) ────────────────────

// A research initiative; a designed investigation. Owner-scoped to a Profile.
export const project = pgTable(
  'Project',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    title: text().notNull(),
    description: text(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('Project_ownerId_idx').on(table.ownerId)],
);

// The testable claim under investigation, nested in a Project.
export const hypothesis = pgTable(
  'Hypothesis',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    statement: text().notNull(),
    rationale: text(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('Hypothesis_projectId_idx').on(table.projectId)],
);

// A citable source attached to a Hypothesis, with full provenance back to the
// literature corpus it came from (CONTEXT.md: Reference). Embedded async for
// later semantic search / clustering.
export const reference = pgTable(
  'Reference',
  {
    id: uuid().primaryKey().defaultRandom(),
    hypothesisId: uuid()
      .notNull()
      .references(() => hypothesis.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    // Provenance: which corpus and that corpus's stable id for the paper.
    source: text().notNull().default('semantic_scholar'),
    externalId: text().notNull(),
    title: text().notNull(),
    authors: jsonb().$type<string[]>().notNull().default([]),
    year: integer(),
    venue: text(),
    url: text(),
    abstract: text(),
    // Populated asynchronously by the reference.embed pgmq worker.
    embedding: vector({ dimensions: REFERENCE_EMBEDDING_DIM }),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('Reference_hypothesisId_idx').on(table.hypothesisId)],
);
