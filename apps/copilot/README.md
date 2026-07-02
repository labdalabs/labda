# @labda/copilot — the antagonistic research copilot (EVE agent)

A standalone [EVE](https://eve.dev) agent (Vercel's filesystem-first agent
framework) that hosts Labda's **antagonistic copilot**. It challenges a
Hypothesis or Protocol and grounds every push-back in a tool result.

## Why a separate app

The agent's conversational/orchestration layer (model loop, durable sessions,
HTTP + platform channels) lives here, decoupled from the Nest backend. Its
**tools call the labda GraphQL API's grounded challenge engine** (`libs/core/copilot`),
so the agent can only surface evidence-grounded findings — a Reference quote, a
logic gap, or a missing Protocol step. No vibes.

This complements ADR-0017 (assistant-ui + AI SDK) and issue #14 (evaluate EVE as
the standard agent layer).

## Layout (EVE conventions)

```
agent/
  agent.ts                 model + runtime config
  instructions.md          the antagonistic-copilot system prompt
  lib/labda.ts             GraphQL client for the labda API
  tools/
    challenge_hypothesis.ts        -> challengeHypothesis(hypothesisId)
    find_contradicting_evidence.ts -> contradictions only
    challenge_protocol.ts          -> challengeProtocol(protocolId)
```

Each file in `tools/` becomes a tool the model can call; the filename is the
tool name.

## Run it

Prerequisites: Node 24+, the labda API running (`pnpm nx run api:serve`), a model
credential, and the acting researcher's token.

```bash
# from repo root
cp apps/copilot/.env.example apps/copilot/.env   # fill in the values

# model credential — Vercel AI Gateway only:
export AI_GATEWAY_API_KEY=...        # or `vercel link` for VERCEL_OIDC_TOKEN

export LABDA_API_URL=http://localhost:3001/api/graphql
export LABDA_TOKEN=<a Supabase access token>

pnpm nx run copilot:dev      # eve dev — opens the terminal UI
```

Then ask it, e.g. *"Challenge hypothesis &lt;id&gt;"* and watch it call
`challenge_hypothesis` and report the grounded findings.

The same grounded engine is also exposed directly on the labda GraphQL API
(`challengeHypothesis` / `challengeProtocol` queries) and as MCP tools
(`challenge_hypothesis`, `find_contradicting_evidence`) — the in-product copilot
thread in the web UI uses that path and does not require this agent to be
running.
