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
  agent.ts                 model + runtime config (Vercel AI Gateway)
  instructions.md          the antagonistic-copilot system prompt
  lib/labda.ts             GraphQL client for the labda API
  tools/                   each file is a tool; the filename is the tool name
    # research flow
    start_project.ts               -> createProject
    formulate_hypothesis.ts        -> addHypothesis
    search_papers.ts               -> searchLiterature
    attach_paper.ts                -> attachReference
    new_papers.ts                  -> newPapers (recent, not-yet-attached)
    # challenge (grounded)
    challenge_hypothesis.ts        -> challengeHypothesis
    find_contradicting_evidence.ts -> contradictions only
    challenge_protocol.ts          -> challengeProtocol
    # knowledge (OKF / fff)
    browse_okf.ts                  -> knowledgeGraph (walk the graph)
    init_okf_local.ts              -> exportKnowledgeLocal (/tmp/labda copy)
  schedules/
    daily-paper-digest.md          cron 09:00 UTC — new-paper digest
  evals/                           tool-call evals (start-project, find-papers, …)
```

Every tool calls labda's grounded engine over GraphQL, so the agent can only act
on real data — no vibes. The daily schedule runs the new-paper digest (flags
papers that support/contradict a Hypothesis, or that failed to publish).
Channels: the built-in EVE HTTP channel powers the in-product chat (#14); add
`agent/channels/*` (Slack/Discord/Telegram/…) to message the researcher
directly.

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

## Slack bot (issue #20)

The agent can live in Slack via the EVE Slack channel + **Vercel Connect** (no
`SLACK_BOT_TOKEN`/`SLACK_SIGNING_SECRET` to manage). One-time setup:

```bash
# 1. Connect client (Slack app credentials + inbound verification)
npm install -g vercel@latest && export FF_CONNECT_ENABLED=1
vercel connect create slack --triggers
vercel connect detach <uid> --yes
vercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes
#    (UID e.g. `slack/labda` — matches connectSlackCredentials in
#     agent/channels/slack.ts. Or use the Connect dashboard.)

# 2. Deploy the agent (recognises eve as a framework)
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 vercel deploy --prod
```

Then install the Slack app to the workspace. `@mention` the bot or DM it; it
replies in-thread using the same grounded tools. Proactive posts (e.g. the daily
new-paper digest) can be delivered to a thread from `agent/schedules`.
