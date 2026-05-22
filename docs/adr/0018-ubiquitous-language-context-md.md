# ADR-0018: Ubiquitous Language via CONTEXT.md

## TL;DR

Every project keeps a `CONTEXT.md` at its repo root: a flat glossary of domain terms with definition AND explicit "avoid" synonyms. Agents and contributors use that vocabulary in code, in commits, in issues, in conversations. Multi-context repos use `CONTEXT-MAP.md` at the root pointing to per-context `CONTEXT.md` files. The glossary is the single canonical answer to "what do we call this thing."

**Status:** Accepted
**Date:** 2026-05-11

## Context

DDD's Ubiquitous Language is the single most undervalued discipline in a codebase: when "user," "account," "customer," and "person" all refer to the same thing in different places, every refactor is a search-and-replace and every onboarding conversation is a translation. Architecture decisions (ADRs) tell you why the system is shaped a certain way; they don't tell you what to call things.

`CONTEXT.md` solves this with two practices:

1. **Each term gets a definition** in domain language, not implementation language.
2. **Each term lists synonyms to avoid** — explicit anti-vocabulary. "Avoid: account, person, human" makes the glossary opinionated.

A companion `docs/agents/domain.md` skill (or `AGENTS.md`) tells AI agents to read `CONTEXT.md` before exploring the codebase and to use its vocabulary in everything they produce (commits, issues, refactor proposals, test names). When a term isn't in the glossary, the agent should treat that as a signal — either it's inventing language the project doesn't use, or there's a real gap to flag.

## Decision

**Every repo keeps a `CONTEXT.md` at its root.** It is the single canonical glossary of domain terms.

**Format (per term):**

```markdown
**<Term>**:
<One-paragraph definition in the project's domain language. Be specific; reference how the term shows up in the system if helpful (table, header, URL segment).>
_Avoid_: <synonym 1>, <synonym 2>, <synonym 3>
```

**Sections (typical, in order):**

1. **Language** — the glossary itself: every entity, role, value object, and key event in the system.
2. **Relationships** — short bullets describing how the terms relate ("An Organization contains one or more Projects"; "An Invitation grants access to exactly one Project").
3. **Other relevant sections** — when the domain has natural subdivisions: AI Surfaces, Auth, Operation Log, MCP Tools, etc. Each subsection is a few paragraphs that use the glossary terms.
4. **Flagged ambiguities** — a running list of "we haven't decided what to call this yet" notes. Empty is fine.

**Multi-context repos:**

If the repo holds multiple bounded contexts that warrant separate glossaries, place a `CONTEXT-MAP.md` at the root listing them, and put one `CONTEXT.md` per context (typically under `libs/<area>/<context>/CONTEXT.md` or `src/<context>/CONTEXT.md`).

```
# Single-context (most projects)
/
├── CONTEXT.md
├── docs/adr/

# Multi-context
/
├── CONTEXT-MAP.md
├── docs/adr/                    ← system-wide decisions
└── libs/api/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/            ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

**Rules:**

- **Code uses the glossary's term.** Class names, table names, GraphQL types, REST paths, event names — all use the canonical term defined in `CONTEXT.md`. Synonyms in the "Avoid" list are review comments.
- **Documentation uses the glossary's term.** README, ADRs, this file, commit messages, issue titles, PR descriptions.
- **Avoid synonyms are real prohibitions.** When you write "the participant" in an issue, that's a review comment.
- **AI agents follow the glossary.** Skills (or AGENTS.md) instruct agents to read `CONTEXT.md` before answering, use its vocabulary in their output, and flag ADR conflicts explicitly.
- **The glossary is lazy.** Add a term when it first matters; don't pre-populate. An entry exists because somebody resolved ambiguity, not because somebody filled out a template.
- **Flag, don't fix silently.** If a term is missing, leave a "Flagged ambiguities" note rather than inventing one.

## Consequences

**Accept:**

- One canonical answer to "what do we call this." Onboarding shortcut: a new contributor reads `CONTEXT.md` once and is fluent.
- Refactors that rename a concept become a glossary update plus a global rename — both visible in a single PR.
- AI agents (and humans) stop drifting into synonyms; vocabulary stays tight.
- Multi-context projects keep their domain languages distinct without bleeding into each other.

**Live with:**

- The file requires ongoing care. A stale glossary is worse than no glossary — it teaches the wrong vocabulary.
- "Avoid" synonyms are opinionated and will occasionally feel pedantic. The cost is worth it.
- When two terms genuinely diverge (e.g., the system has both "Sheet" and "Worksheet" for different things), the glossary needs to capture the distinction explicitly, not collapse them.
- Multi-context repos add `CONTEXT-MAP.md` overhead. For single-context repos the map is unnecessary noise — don't add one until the second context arrives.
