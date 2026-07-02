# ADR-0025: Knowledge graph in OKF — complementary to embeddings

## Status

Accepted

## Context

Issue #6 gave References vector **embeddings** (pgvector) for similarity. Issue
#13 asks whether an explicit **knowledge graph** (Open Knowledge Format) should
replace or augment that, and where the graph lives.

Embeddings answer "what is *similar*"; they infer relatedness from text and are
lossy and unexplainable. Research reasoning also needs "what is *stated*" — a
Reference *contradicts* a Hypothesis, a Project *contains* a Protocol — typed,
explainable relations an agent can walk and cite.

## Decision

Adopt an **OKF-shaped knowledge graph alongside embeddings — not instead of
them.** The two are complementary:

- **Embeddings** (literature context): similarity search / clustering over
  Reference text. Unchanged.
- **OKF graph** (new `knowledge` context): explicit typed nodes (Project,
  Hypothesis, Protocol, Reference) and typed edges (`contains`, `cites`,
  `supports`, `contradicts`). The `supports`/`contradicts` edges are the
  **grounded** copilot stances (ADR from #10), so the graph carries evidence,
  not vibes.

The v0 graph is **derived on read** from the existing facades (research,
protocol, copilot) — no separate node/edge tables to keep in sync, so the graph
can never drift from the source of truth. If graph queries become a hot path,
materialise it from domain events later.

- **Serialization / interop — OKF to spec**: exported as a real **OKF v0.1
  Knowledge Bundle** (GoogleCloudPlatform/knowledge-catalog) — a *directory of
  markdown files with YAML frontmatter*, one concept per file, file path as
  identity, concepts cross-linked with markdown links, `type` required,
  `index.md` for progressive disclosure. Two persistence targets:
  - **remote**: uploaded to Supabase Storage (ADR-0022) via `exportKnowledge`,
    returning a signed URL to the bundle's `index.md`.
  - **local (filesystem)**: written to `OKF_LOCAL_DIR` (default `/tmp/labda`)
    via `exportKnowledgeLocal`, so the agent initialises/browses a local copy.
- **Free browse**: a `neighbours(nodeId)` primitive (fff-style) lets the
  antagonistic agent walk the graph; exposed as the `browse_knowledge` MCP tool.

## Consequences

**Accept:**

- Typed, explainable relations an agent can cite; the graph is always
  consistent with the entities because it is derived.
- OKF interop for sharing/importing knowledge; Storage-backed export.

**Live with:**

- Deriving on read recomputes the graph each call (includes a copilot pass per
  Hypothesis). Fine at v0 sizes; materialise from events if it gets hot.
- `fff` itself (the Obsidian-like browser) is a follow-up (#18); v0 ships the
  graph + neighbourhood primitive it needs.

## References

- ADR-0006 (pgvector embeddings), ADR-0022 (Storage), issue #6, #10, #13, #18
