# ADR-0015: Nx tag-based boundary enforcement

## TL;DR

Every Nx project carries three tag dimensions — `scope:* {api,ui,shared}`, `type:* {common,domain,feature,test}`, `target:* {server,client,isomorphic}` — and `@nx/enforce-module-boundaries` rejects imports that cross them. The architecture from ADR-0001/0002/0014 becomes a lint error instead of a code-review reminder.

**Status:** Accepted
**Date:** 2026-05-11

## Context

ADR-0001 splits the workspace into `apps/` and `libs/{core,shared/isomorphic,shared/client,...}`. ADR-0002 puts bounded contexts under `libs/core/<context>`. ADR-0014 distinguishes isomorphic, client-only, and server-only frontend code. Without tooling, all of these rules are enforced by reviewer attention. The realities:

- A new contributor imports a server-only package from a Next.js page and the build still succeeds — until production, when a Node-only dependency tries to ship to the browser.
- An isomorphic lib accidentally takes a dependency on a server-only lib and the next consumer breaks.
- A `feature`-layer lib imports into a `common`-layer lib (wrong direction) and circular concerns sneak in.

Nx ships `@nx/enforce-module-boundaries`, a lint rule that consults each project's `tags` array and rejects disallowed imports. With three orthogonal tag dimensions, we can encode all three concerns at once.

## Decision

Every project in `apps/` and `libs/` declares tags along three dimensions in its `project.json`:

| Dimension | Values | Meaning |
|---|---|---|
| `scope:*` | `api`, `ui`, `shared` | Logical area the project belongs to. |
| `type:*` | `common`, `domain`, `feature`, `test` | Architectural layer. Common is the lowest, feature the highest. |
| `target:*` | `server`, `client`, `isomorphic` | Runtime. Server and client are mutually exclusive; both may consume isomorphic. |

The rules expressed in `eslint.config.mjs` (`@nx/enforce-module-boundaries`):

- `scope:api` may depend on `scope:api`, `scope:shared`, `target:server`, `target:isomorphic`.
- `scope:ui` may depend on `scope:ui`, `scope:shared`, `target:client`, `target:isomorphic`.
- `scope:shared` may depend only on `scope:shared`, `target:isomorphic`. (No reaching up into api or ui.)
- `type:common` → `common` only.
- `type:domain` → `common` and `domain`.
- `type:feature` → `common`, `domain`, and `feature`.
- `target:server` → `server`, `isomorphic`.
- `target:client` → `client`, `isomorphic`.
- `target:isomorphic` → `isomorphic` only.

The rules live in the root `eslint.config.mjs` under the `@nx/enforce-module-boundaries` rule's `depConstraints`. Every project's `tags` array in its `project.json` is the input.

**New libs MUST be tagged at creation.** An untagged project is effectively allowed anywhere — the boundary check is silently bypassed. Generator templates should fail loudly when tags are missing.

Typical assignments:

| Project | Tags |
|---|---|
| `apps/api` | `scope:api`, `target:server` |
| `apps/ui` | `scope:ui`, `target:client` |
| `libs/api/auth` | `scope:api`, `type:domain`, `target:server` |
| `libs/api/sheet` | `scope:api`, `type:feature`, `target:server` |
| `libs/shared/isomorphic/models` | `scope:shared`, `type:common`, `target:isomorphic` |
| `libs/shared/isomorphic/formula` | `scope:shared`, `type:domain`, `target:isomorphic` |
| `libs/shared/client/ui` | `scope:ui`, `type:domain`, `target:client` |
| `apps/*-e2e` | `scope:<area>`, `type:test` |

## Consequences

**Accept:**

- Layering and target-runtime separation become compile-time errors. The architecture diagram is the lint rules.
- Refactors that violate boundaries fail in CI on the first push.
- Onboarding gets simpler: contributors don't need to memorize which libs are server-only — they get a clear ESLint error if they cross the line.
- `nx graph --focus=<project>` plus the tag rules makes "what can this depend on" answerable mechanically.

**Live with:**

- Every new project requires three tag decisions before code is written. Generator templates and a CONTRIBUTING note should make this routine.
- The tag taxonomy is itself a decision that ossifies. Adding a fourth dimension (e.g., `tenant:*`) requires a coordinated lint-rule update.
- Untagged projects silently bypass enforcement. Add a CI step that lists projects missing required tag dimensions and fails the build until they're tagged.
- Cross-cutting libraries (`libs/core/common`) need careful tagging: typically `scope:shared` is wrong (it's backend-only) and `scope:api`, `type:common`, `target:server` is the right answer. Document the recipe with the lib.
