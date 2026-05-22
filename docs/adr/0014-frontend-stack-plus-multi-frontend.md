# ADR-0014: Frontend stack and multi-frontend sharing

## TL;DR

Next.js App Router + Apollo Client + Tailwind + Radix (shadcn copy-in) + Zustand + react-hook-form + Zod. Single-frontend projects collapse shared frontend code into `libs/shared/client/ui`; multi-frontend projects split into `libs/shared/client/{providers,hooks,components,utils}` plus per-app feature libs. Offline-first IndexedDB sync layers are opt-in. AI chat UIs use `assistant-ui` (see ADR-0017).

**Status:** Accepted
**Date:** 2026-05-11

## Context

The frontend is Next.js consuming the API (GraphQL by default; REST/MCP for AI-native projects). We want:

- A typed, cached client that integrates with Next App Router (server + client components).
- A component library that matches the design language (dark-first, accessible primitives, copy-in customization).
- Predictable state management and form handling.
- A sharing strategy that avoids copy-paste when the project ships multiple Next.js apps.
- Optional offline-first behavior for projects that need it.

We are not building everything from scratch; we are picking a stack with strong defaults and minimal glue.

## Decision

**Framework:**

- **Next.js (App Router) + React.** Server components for shells and data-heavy layout; client components for interactivity. `'use client'` is opt-in, not the default.
- Run with `pnpm nx dev <ui-app>`.

**GraphQL / API client:**

- `@apollo/client` for caching and queries (GraphQL projects).
- `@apollo/client-integration-nextjs` for SSR/streaming compatibility.
- Wrapped in an `ApolloClientProvider` that lives in the shared frontend lib.
- API URL from `NEXT_PUBLIC_API_URL`, trimmed and suffixed with `/graphql` in the provider.
- For REST/MCP projects, use the standard `fetch` API (or a thin wrapper) and attach the auth bearer token in a custom transport.

**Component primitives:**

- **Radix UI** for unstyled, accessible primitives (`@radix-ui/react-*`).
- **Tailwind CSS** (v4) for styling.
- **shadcn-style copy-in components.** `components.json` drives `pnpm dlx shadcn add <component>`. Components live as source files in the repo, not as an npm dependency.
- Auxiliary libraries: `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`, `tw-animate-css`.

**State:**

- **Apollo cache** for server-state (default, GraphQL projects).
- **Zustand** for client-side stores that need to live outside React's render tree (e.g., layout state, ephemeral UI state).
- **`localStorage` / `IndexedDB`** for offline-first cases — per-domain `-idb` libs that hold offline replicas of API data with sync logic. Opt-in per domain.

**Forms:**

- `react-hook-form` for form state and submission.
- `@hookform/resolvers` to bridge Zod schemas to RHF.
- `zod` for schemas. Wherever the same shape is validated server-side, the Zod schema lives in `libs/shared/isomorphic` and is consumed by both sides.

**Theme & feedback:**

- `next-themes` with `defaultTheme: 'dark'`, `enableSystem`, `disableTransitionOnChange`.
- `sonner` for toasts.
- `cmdk` for command palette.
- `vaul` for sheet/drawer.

**Analytics:**

- `posthog-js` on the client, `posthog-node` on the server.
- Wrapped in `PostHogProvider`.

**AI chat (when applicable):**

- `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` for the in-UI assistant. See ADR-0017.

### Multi-frontend sharing

When a project has more than one Next.js app, code is split as follows:

| Path | Contents |
|------|----------|
| `libs/shared/isomorphic/models` | DTOs and enums shared with the backend (single source of truth). |
| `libs/shared/isomorphic/utils` | Pure functions shared across all boundaries. |
| `libs/shared/client/providers` | `ApolloClientProvider`, `PostHogProvider`, theme provider — used by every Next app. |
| `libs/shared/client/hooks` | Reusable client hooks. |
| `libs/shared/client/components` | Reusable UI primitives (shadcn-style). |
| `libs/shared/client/utils` | Client-side utilities. |
| `libs/shared/client/<domain>-idb` | Per-domain IndexedDB sync layer (offline-first). |
| `libs/<app>/components` | App-scoped feature components. |
| `libs/<app>/hooks` | App-scoped hooks. |
| `libs/<app>/providers` | App-scoped providers. |
| `libs/<app>/store` | App-scoped Zustand stores. |
| `apps/<ui-app>/src/app` | Routes, layouts, and page shells specific to this app. |

Single-frontend projects collapse to `libs/shared/client/ui` (one shared frontend lib) plus the app's own `src/`. Either layout is acceptable as long as the boundary (isomorphic-vs-client, shared-vs-app-scoped) is preserved. The Nx tag rules from ADR-0015 enforce the layering.

## Consequences

**Accept:**

- One API schema, one cache, one provider stack across every frontend.
- Shared isomorphic Zod schemas mean form validation matches server validation by construction.
- Adding a new Next app is mostly composition: provider stack from `libs/shared/client`, feature code in a new `libs/<app>/`.
- Component library is copy-in; long-term ownership is in the repo, not in upstream npm versions.

**Live with:**

- Multiple frontends mean multiple deployables, multiple feature-flag surfaces, and multiple places where the auth flow must be implemented. Discipline at the shared provider layer mitigates this; per-app divergence creeps in if reviewers don't push back.
- Offline-first (IDB) layers are an opt-in advanced pattern. They are not free: every domain that gets an IDB layer needs an explicit conflict-resolution policy. Do not add IDB layers for domains that don't need offline.
- Apollo cache + Zustand + IDB can fight if the same data is held in three places. The rule: server data lives in Apollo; ephemeral UI lives in Zustand; offline replicas (when needed) live in IDB and sync to Apollo on reconnect. Reviewers should flag any state that has crossed boundaries without rationale.
- shadcn-style copy-in means every project owns its copy of `Button`, `Input`, etc. Upgrades are manual. The benefit (full control, no breaking-version surprises) is worth the cost.
