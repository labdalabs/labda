# Labda

A beautiful, AI-native, Jupyter-native workspace that streamlines computational research and quietly becomes the ELN by capturing the process record.

## Language

**Lab**:
A research group or individual researcher's top-level space.
_Avoid_: Organization, team, account

**Project / Study**:
A research initiative; a designed investigation. 
_Avoid_: Workspace, repo

**Hypothesis**:
The testable claim under investigation.

**Protocol**:
The method/procedure; forkable, citable.
_Avoid_: Recipe, SOP, template

**Reference**:
A citable source, literature, or prior research context supporting the investigation.

### Forthcoming (not yet modelled)

**Dataset**:
Acquired/collected data.
_Avoid_: File, upload

**Notebook**:
The computational record (Jupyter) = ELN unit.
_Avoid_: Document, page, file

**Analysis**:
Computational work over a dataset.
_Avoid_: Job, script run

**Finding / Result**:
Interpreted outcome; claim supported/refuted.
_Avoid_: Output

**Report → Preprint → Paper**:
Write-up → pre-publication → published.
_Avoid_: Doc, article

**Preregistration**:
Time-stamped, locked study plan (pre-data).
_Avoid_: Spec, plan

**Replication / Reproduction**:
Verification acts (new data / same data).
_Avoid_: Re-check, retest

**Provenance**:
The chain linking a finding back to its data & method.
_Avoid_: History, audit log

## Relationships

- A **Lab** contains one or more **Projects** (also known as Studies).
- A **Project / Study** nests the core research design artifacts: **Hypothesis**, **Protocol**, and **Reference**.
- Thus, the nesting follows: Lab → Project → Hypothesis / Protocol / Reference

## Flagged ambiguities

_(none yet)_

---

## How to use this file

- **Contributors**: read this before writing code, issues, or commit messages. Use the canonical term; treat the "Avoid" list as prohibitions.
- **AI agents**: this is your vocabulary. See [`AGENTS.md`](./AGENTS.md) and [`docs/adr/0018-ubiquitous-language-context-md.md`](./docs/adr/0018-ubiquitous-language-context-md.md) for the broader practice.
- **When a term is missing**: that's a signal. Either you're inventing language the project doesn't use (reconsider) or there's a real gap to add (flag it under "Flagged ambiguities" and resolve in the next review).

## Related

- [`docs/adr/`](./docs/adr/README.md) — architecture decisions. ADRs use the vocabulary defined here.
- For multi-context repos: replace this file with `CONTEXT-MAP.md` listing per-context `CONTEXT.md` files. See ADR-0018.
