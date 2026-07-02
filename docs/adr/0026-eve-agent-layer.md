# ADR-0026: EVE as the agent layer (reconciles ADR-0017)

## Status

Accepted — extends/supersedes ADR-0017 for the agent surface.

## Context

ADR-0017 chose `assistant-ui` + Vercel AI SDK `streamText` in a Nest controller
for the in-UI assistant. Since then we built the **antagonistic copilot** (#10)
as a grounded engine exposed over GraphQL + MCP, and adopted **Vercel EVE**
(#14) — a filesystem-first agent framework — as a dedicated app (`apps/copilot`)
running the research agent.

## Decision

The **agent orchestration layer is EVE** (`apps/copilot`), not a hand-rolled
Nest `streamText` controller. Rationale:

- EVE gives durable sessions (Vercel Workflow), a stable HTTP session API, tools
  as files, and platform channels — far more than the ~150-line controller
  ADR-0017 anticipated.
- The agent's **tools call labda's grounded engine** (challenge/knowledge over
  GraphQL), so agent answers stay evidence-grounded — the ADR-0017 principle
  that tools are the one source of truth is preserved.

Frontend integration:

- The web app talks to the agent through a **same-origin proxy**
  (`/api/eve/*` → `EVE_URL`), so there's no CORS and tokens attach server-side.
- `EveChat` starts a session and streams the NDJSON reply.
- The **in-product grounded copilot thread** (#10) remains the default, always
  available surface (no model credential required); the EVE agent is the richer
  conversational layer for open-ended research help.

`assistant-ui` (ADR-0017) is no longer the chosen surface, but the model-tool
principle and the option to render EVE's stream with assistant-ui components
remain open.

## Consequences

**Accept:** durable, file-defined agents; grounded tools; a clean proxy for the
frontend; the grounded copilot still works with zero model credential.

**Live with:** EVE needs a model credential via the **Vercel AI Gateway**
(`AI_GATEWAY_API_KEY`) to run live — no direct provider key. Per-user token
threading into agent tools (so the agent acts strictly as the signed-in
researcher) is a follow-up (#18). EVE pins a newer `ai` (v7); the workspace was
bumped to match.

## References

- ADR-0017 (what this reconciles), #10 (grounded copilot), #14, #18
