import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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

// Grants a Profile access to a Project it does not own (collaboration). The
// owner is implicit (Project.ownerId) and never has a ProjectMember row.
export const projectMember = pgTable(
  'ProjectMember',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => profile.id),
    role: text().notNull().default('editor'),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ProjectMember_projectId_userId_key').on(
      table.projectId,
      table.userId,
    ),
    index('ProjectMember_userId_idx').on(table.userId),
  ],
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
    // Open-access PDF URL when the paper is lawfully downloadable (never a
    // paywall-circumvention source). Cached to Storage on demand (issue #19).
    openAccessPdfUrl: text(),
    // Populated asynchronously by the reference.embed pgmq worker.
    embedding: vector({ dimensions: REFERENCE_EMBEDDING_DIM }),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('Reference_hypothesisId_idx').on(table.hypothesisId)],
);

// ─── protocol context (CONTEXT.md: Protocol / Notebook) ─────────────────────

// An experiment Protocol authored as a Jupyter-compatible notebook. The
// notebook document (nbformat 4 JSON) is stored verbatim so `.ipynb` round-trips
// losslessly. `version` increments on each save; snapshots live in
// ProtocolVersion.
export const protocol = pgTable(
  'Protocol',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    title: text().notNull(),
    // The full nbformat-4 notebook document.
    notebook: jsonb().$type<Record<string, unknown>>().notNull(),
    version: integer().notNull().default(1),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('Protocol_projectId_idx').on(table.projectId)],
);

// Append-only snapshot of a Protocol's notebook at each saved version.
export const protocolVersion = pgTable(
  'ProtocolVersion',
  {
    id: uuid().primaryKey().defaultRandom(),
    protocolId: uuid()
      .notNull()
      .references(() => protocol.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    notebook: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('ProtocolVersion_protocolId_idx').on(table.protocolId)],
);

// ─── analysis context (CONTEXT.md: Analysis) ────────────────────────────────

// Computational work over a dataset derived from a Protocol's results:
// descriptive calculations + a generated chart, exportable to `.xlsx`.
export const analysis = pgTable(
  'Analysis',
  {
    id: uuid().primaryKey().defaultRandom(),
    protocolId: uuid()
      .notNull()
      .references(() => protocol.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    name: text().notNull(),
    // { columns: string[], rows: number[][] }
    inputData: jsonb().$type<Record<string, unknown>>().notNull(),
    // Computed stats + chart spec.
    results: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('Analysis_protocolId_idx').on(table.protocolId)],
);

// A user-drawn link between two knowledge-graph nodes (Obsidian-like). Node ids
// are the OKF node ids (e.g. "hypothesis:<uuid>"), so links can connect any
// entities — notebooks, hypotheses, references — across the Project.
export const knowledgeLink = pgTable(
  'KnowledgeLink',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    fromNodeId: text().notNull(),
    toNodeId: text().notNull(),
    label: text(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('KnowledgeLink_projectId_idx').on(table.projectId)],
);

// A first-class knowledge-graph node authored by a user or an agent (as opposed
// to the nodes derived from Project/Hypothesis/Protocol/Reference entities).
// Its OKF node id is "node:<uuid>". `type` is an OkfNodeType string, `content`
// is a markdown body, `sourceRef` points at a Storage path / URL to a source
// file (pdf/csv) when the node is backed by one.
export const knowledgeNode = pgTable(
  'KnowledgeNode',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    type: text().notNull(),
    title: text().notNull(),
    content: text().default(''),
    sourceRef: text(),
    attributes: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('KnowledgeNode_projectId_idx').on(table.projectId)],
);

// ─── agent context (persistent EVE agent sessions) ─────────────────────────

// A saved EVE agent thread scoped to a Project + goal. The full chat transcript
// (and optional agent session state) is persisted so a thread survives reloads.
// `transcript`/`sessionState` are stored as jsonb: the resolver boundary accepts
// them as JSON strings, JSON.parse into these columns on write and JSON.stringify
// back to a string on read (transcript defaults to the empty array []).
export const agentSession = pgTable(
  'AgentSession',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => profile.id),
    goal: text().notNull(),
    transcript: jsonb().$type<unknown>().notNull().default([]),
    sessionState: jsonb().$type<unknown>(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [index('AgentSession_projectId_idx').on(table.projectId)],
);

// Hex-grid board position of a knowledge-graph node within a Project. `nodeId`
// is the OKF node id (e.g. "node:<uuid>" or "hypothesis:<uuid>"), so any node —
// authored, hypothesis, protocol, reference — can be placed on the board.
// (q, r) are axial hex coordinates. One position per node per Project.
export const nodePosition = pgTable(
  'NodePosition',
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    nodeId: text().notNull(),
    q: integer().notNull(),
    r: integer().notNull(),
    updatedAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('NodePosition_projectId_nodeId_key').on(
      table.projectId,
      table.nodeId,
    ),
  ],
);
