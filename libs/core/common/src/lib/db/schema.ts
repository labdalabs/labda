import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

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
