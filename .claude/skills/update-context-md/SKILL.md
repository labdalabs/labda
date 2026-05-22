---
name: update-context-md
description: Use when the user asks to "add a term to the glossary", "update CONTEXT.md", "define [term]", "the project doesn't have a word for X", or wants to maintain the Ubiquitous Language. Adds a term with definition + "Avoid" synonyms, or flags drift in the code.
---

# update-context-md

Maintain the Ubiquitous Language glossary (`CONTEXT.md` at repo root). Every term gets a definition AND an explicit "Avoid" list of synonyms — that's what makes the glossary opinionated.

## When to use

- A new domain concept has emerged and the team is using inconsistent terms for it.
- A PR introduces a class/table/route name that doesn't match the glossary — either add it, or rename to match.
- The user explicitly asks to define a term.
- During an architecture review, terms in code don't appear in `CONTEXT.md`.

## Inputs to confirm

1. **The term** (singular, in the project's preferred casing — typically PascalCase for proper nouns).
2. **Definition** — what it is in domain language. Reference its system anchor (table name, URL segment, header) when helpful.
3. **Synonyms to avoid** — at least 1, ideally 2-3. These are the words the team should NOT use.
4. **Relationships** — does it contain, belong to, or interact with other terms? Add to the Relationships section.

## Steps

1. **Read the current `CONTEXT.md`.** Note alphabetical / categorical order, if any.

2. **Add the new term in the `Language` section** using the canonical format:

   ```markdown
   **<Term>**:
   <One-paragraph definition. Specific. Anchored to a system artifact when possible — "stored in the `<table>` table"; "served at `/api/<resource>/:id`"; "carried as the `X-<Header>` header".>
   _Avoid_: <synonym 1>, <synonym 2>, <synonym 3>
   ```

3. **Update the `Relationships` section** if this term connects to existing terms:

   ```markdown
   - A <Term> belongs to one <Other Term>.
   ```

4. **Audit the codebase for drift.** Search for the "Avoid" synonyms:

   ```bash
   grep -ri "<avoid-synonym>" apps/ libs/ --include="*.ts" --include="*.tsx" | head
   ```

   Each hit is a candidate rename. Open a follow-up issue or fix immediately if the count is small.

5. **Update `Flagged ambiguities`** if you encountered any contested usage that this entry resolves. Or if a new ambiguity emerged, add it there rather than silently inventing the term.

## When to skip

- The term is project-specific shorthand that doesn't appear in user-facing or domain code (e.g., a helper class name). Don't glossary internal scaffolding.
- The term is already in `CONTEXT.md`. Update the existing entry instead of duplicating.

## Multi-context repos

If `CONTEXT-MAP.md` exists at the root, the term may belong to a specific context's `CONTEXT.md` (under `libs/<area>/<context>/CONTEXT.md` or similar). Add it there. If a system-wide concept truly crosses contexts, it goes in the root glossary referenced by `CONTEXT-MAP.md`.

## Example entry

```markdown
**Invoice**:
A finalized bill issued to a workspace for a billing period. Stored in the `invoice` table. Has one or more line items linked via `invoice_line_item.invoice_id`. Created by the billing context when the period closes; never deleted (mark `void` instead).
_Avoid_: bill, statement, receipt, charge

**Line Item**:
A single billable component of an Invoice (subscription tier, usage, add-on). Stored in `invoice_line_item`. Always belongs to exactly one Invoice.
_Avoid_: charge, fee, item, row
```

## Rules

- **DO** lead each entry with the definition, not the synonyms.
- **DO** anchor to system artifacts when possible (table, header, URL).
- **DO** include "Avoid" — even one or two synonyms. The list is the point.
- **DO** flag rather than fix when ambiguity is genuinely unresolved.
- **DON'T** glossary every internal class. Only domain language.
- **DON'T** add a term you don't intend to enforce. Stale glossary > no glossary.

## References

- ADR-0018: Ubiquitous Language via CONTEXT.md
- `CONTEXT.md` in the repo root (the file you're updating)
