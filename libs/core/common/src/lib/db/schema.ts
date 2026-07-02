import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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
