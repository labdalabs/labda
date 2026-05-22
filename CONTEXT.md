# <Project name>

<One-paragraph description of what the project is. Domain language, not implementation language.>

## Language

**<Term>**:
<One-paragraph definition in the project's domain language. Specific. Reference how the term shows up in the system if helpful — a table name, a URL segment, a header.>
_Avoid_: <synonym 1>, <synonym 2>, <synonym 3>

**<Term>**:
<...>
_Avoid_: <...>

<!--
Example of the shape (replace with the project's actual terms):

**Organization**:
The primary shareable unit — a named container that groups Members and Projects. Access control, billing, and external integrations are scoped to an Organization. Stored in the `organization` table.
_Avoid_: account, tenant, company, workspace (when referring to the container)

**Member**:
A human Actor authenticated via OAuth (the only auth path). Members hold a role on each Organization they belong to (`owner / admin / member`).
_Avoid_: user, account, person

Notes for filling this file in:
- Lead with the most fundamental terms (the ones other terms reference).
- Be ruthless about "Avoid". The list is what makes the glossary opinionated.
- Reference the system: "stored as `key_hash` in `<table>`", "served at `/api/<resource>/:id`". Glossary terms should anchor to artifacts.
- Don't pre-populate. Add a term when it first matters.
-->

## Relationships

<Short bullets describing how the terms relate to each other. One or two lines each.>

<!--
Example:
- An Organization contains one or more Projects.
- Access granted to an Organization covers all its Projects (unless project-level overrides exist).
- A Member holds one role (`owner / admin / member`) on an Organization.
- An Invitation grants access to exactly one Organization at a specified role.
-->

## <Optional sections>

<When the domain has natural subdivisions, add sections like "AI Surfaces", "Auth", "Audit Log", "Integrations", etc. Each is a short prose explanation that uses the glossary terms.>

## Flagged ambiguities

_(none yet)_

<!--
When a term is contested or undefined, add a note here rather than silently inventing one. Example:

- "Inbox item" vs "Signal" — both used for the same concept across the codebase. Resolve before next refactor.
-->

---

## How to use this file

- **Contributors**: read this before writing code, issues, or commit messages. Use the canonical term; treat the "Avoid" list as prohibitions.
- **AI agents**: this is your vocabulary. See [`AGENTS.md`](./AGENTS.md) and [`docs/adr/0018-ubiquitous-language-context-md.md`](./docs/adr/0018-ubiquitous-language-context-md.md) for the broader practice.
- **When a term is missing**: that's a signal. Either you're inventing language the project doesn't use (reconsider) or there's a real gap to add (flag it under "Flagged ambiguities" and resolve in the next review).

## Related

- [`docs/adr/`](./docs/adr/README.md) — architecture decisions. ADRs use the vocabulary defined here.
- For multi-context repos: replace this file with `CONTEXT-MAP.md` listing per-context `CONTEXT.md` files. See ADR-0018.
