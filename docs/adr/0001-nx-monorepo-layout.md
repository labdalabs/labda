# ADR-0001: Nx monorepo with apps and libs layout

## TL;DR

Nx monorepo with pnpm and SWC. Top-level is always `apps/{core, <ui-app>, *-e2e}` plus `libs/{core, shared/isomorphic, shared/client, ...}`. Graph-aware builds, affected-only CI, isomorphic types stay in lockstep across backend and frontend. See also ADR-0015 for the lint-enforced layering on top of this layout.

**Status:** Accepted
**Date:** 2026-05-11

## Context

Each project ships multiple deployables (a NestJS backend, one or more Next.js frontends, and per-app end-to-end test suites) that share TypeScript types, validation schemas, GraphQL fragments, and domain language. Three options were considered:

1. **Polyrepo.** Forces duplication or out-of-band package publishing for shared code; coordinated changes across backend + frontend become multi-PR rituals.
2. **Plain pnpm workspaces.** Cheap, but lacks a project graph, task caching, "affected only" execution, and code-generation primitives.
3. **Nx monorepo.** Provides graph-aware builds, task caching, generator templates, project boundaries enforced at the tsconfig path level, and good Next.js/Nest.js plugin coverage.

The team values one-PR, one-cycle changes that span backend and frontend, fast CI via affected-only runs, and the ability to evolve isomorphic types in one place.

## Decision

Use Nx (currently v22) as the monorepo tool with pnpm as the package manager and SWC as the transpiler. The repository top level always looks like:

```
apps/
  core/                 NestJS backend (per-project)
  core-e2e/             Backend e2e
  <ui-app>/             Next.js frontend (one or more per project)
  <ui-app>-e2e/         Frontend e2e (Playwright)
libs/
  core/<context>/       Backend bounded contexts (see ADR-0002)
  shared/isomorphic/    Code shared between backend and frontend
  shared/client/        Frontend-only shared code
  <ui-app>/             Per-frontend feature libs (when an app needs scoping)
  packages/sdk/         (optional) Externally published SDK
  infra/, lambdas/      (optional) AWS deployment artifacts (e.g., SST)
```

Tooling defaults:

- Package manager: **pnpm** (Verdaccio for in-repo SDK publish workflows when an SDK lib exists).
- Transpiler: **SWC** for libs, **Webpack** with HMR config for `apps/core` (`webpack.hmr.config.js`).
- Linter: **ESLint flat config** (`eslint.config.mjs`) at root, per-project overrides.
- Formatter: **Prettier**.
- Test runner: **Jest** with a root preset (`jest.preset.js`).
- E2e runner: **Playwright** for Next.js apps, **Jest + supertest** for `apps/core`.

Dev commands:

- `pnpm nx serve-hmr core` — Nest dev with HMR.
- `pnpm nx dev <ui-app>` — Next dev.
- `pnpm nx test <project>` — unit tests for one project.
- `pnpm nx affected ...` — restrict to projects affected by current diff (CI).

## Consequences

**Accept:**

- Single repository, single PR, single CI graph for cross-cutting changes.
- Nx caches builds and tests; CI only rebuilds projects affected by a diff.
- Shared isomorphic types stay in lockstep because backend and frontend import from the same library.
- Contributors learn one set of commands; project graph is discoverable via `nx graph`.

**Live with:**

- Onboarding curve for Nx-specific concepts (project.json, executors, generators, target dependencies).
- Per-library boilerplate: each lib has its own `project.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `eslint.config.mjs`, and `jest.config.cts`. This is real overhead but is offset by automation (Nx generators) and the predictability it provides.
- CI must use `nx affected` discipline to keep wall-clock time manageable as the graph grows.
- The lockfile (`pnpm-lock.yaml`) is large and noisy in diffs; reviewers should ignore it unless they suspect a deliberate dependency change.
