# Deployment

Labda is five deployables. You already run Supabase, the Nest API (Railway) and
the UI (Vercel); this adds the **Jupyter kernel** and the **EVE agent**.

```
                 ┌──────────────┐
   browser ────▶ │ UI (Vercel)  │
                 │  Next.js     │
                 └──┬───┬───┬───┘
      /api/nest ──▶ │   │   │ /api/eve (server-side proxy)
                    │   │   └──────────────▶ ┌─────────────────┐
   ┌────────────────▼┐  │                    │ EVE agent       │
   │ Nest API        │  │ browser WS/REST    │ (Vercel)        │
   │ (Railway)       │  └───────────┐        └───┬─────────────┘
   └──┬───────────┬──┘              │            │ LABDA_API_URL
      │ Postgres  │ Storage/Auth    ▼            ▼ (calls Nest GraphQL)
      ▼           ▼            ┌──────────┐   ┌──────────┐
   ┌─────────────────┐        │ Jupyter  │   │  Nest    │
   │ Supabase        │        │ kernel   │   │  API     │
   └─────────────────┘        │(Railway) │   └──────────┘
                              └──────────┘
```

Deploy order: **Supabase → Nest → Jupyter → EVE → UI** (each needs the URLs of
the ones before it).

---

## 1. Supabase (managed)

- Apply migrations. Drizzle app tables:
  ```bash
  DATABASE_URL=<supabase pooler url> pnpm --filter . exec \
    drizzle-kit migrate --config=apps/api/drizzle.config.ts
  ```
  Supabase-native migrations (extensions, pgmq queue, storage buckets) live in
  `supabase/migrations/` — apply with `supabase db push` (linked project) or run
  each SQL once. Buckets created: `analysis-exports`, `knowledge-okf`,
  `reference-pdfs`.
- Note the values: project URL, anon key, **service_role key**, **JWT secret**.
  (Tokens are ES256/JWKS by default — the API verifies via the JWKS endpoint, so
  no shared secret is needed for real user tokens; the JWT secret still covers
  the HS256 test path.)

## 2. Nest API (Railway)

> **DB connection gotchas (learned in prod):**
> - Use the Supabase **session** connection (port **5432**), not the transaction
>   pooler (6543) — the transaction pooler breaks the query protocol.
> - **Strip the URL query string** (`?supa=…&sslmode=…`). Newer
>   `pg-connection-string` escalates `sslmode=require` to `verify-full`, which
>   rejects Supabase's self-signed cert chain (`SELF_SIGNED_CERT_IN_CHAIN`).
> - Set **`DATABASE_SSL=true`** — the app then connects with TLS +
>   `rejectUnauthorized:false` (the DB module also strips the query defensively).
>
> **Apply migrations to prod** (idempotent), with the service env injected:
> ```bash
> railway run --service <nest> -- bash scripts/prod-migrate.sh
> ```

Env vars:

| var | value |
|---|---|
| `DATABASE_URL` | Supabase **session** URL, port 5432, **no query string** |
| `DATABASE_SSL` | `true` |
| `SUPABASE_URL` | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_JWT_SECRET` | project JWT secret |
| `CORS_ORIGIN` | the UI's Vercel URL (e.g. `https://labda.vercel.app`) |
| `FRONTEND_URL` | same UI URL |
| `SEMANTIC_SCHOLAR_BASE_URL` | `https://api.semanticscholar.org/graph/v1` |
| `SEMANTIC_SCHOLAR_API_KEY` | optional (higher rate limits) |
| `PORT` | Railway sets this |

Start command: `node dist/apps/api/main.js` (after `pnpm nx build api`). The
pgmq embedding worker runs in-process. Note: `OKF_LOCAL_DIR` (default
`/tmp/labda`) is **ephemeral** on Railway — the OKF *remote* export to Supabase
Storage is the durable one; local export is for the agent's scratch use.

## 3. Jupyter kernel (Railway — new)

Deploy `infra/jupyter/Dockerfile` as a second Railway service.

| var | value |
|---|---|
| `ALLOW_ORIGIN` | the UI's Vercel URL (browser connects directly) |
| `KG_AUTH_TOKEN` | a strong token |
| `PORT` | Railway sets this |

The UI's notebook editor **Compute → Jupyter (remote server)** field takes this
service's URL + token. (Optionally set `NEXT_PUBLIC_JUPYTER_URL` on the UI to
prefill it.) This v0 shares one gateway; per-user kernel isolation is a
follow-up (issue #18). Pyodide (in-browser) remains the zero-infra default and
needs none of this.

## 4. EVE agent (Vercel — new)

From `apps/copilot`:

```bash
cd apps/copilot
vercel login          # once
vercel link           # create/link a Vercel project (enables AI Gateway via OIDC)
vercel deploy --prod
```

`eve build` emits the Vercel Build Output automatically; `agent/schedules/*`
become Vercel Cron Jobs. Env vars on the EVE Vercel project:

| var | value |
|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key — **or** rely on project OIDC after `vercel link` (no key) |
| `LABDA_API_URL` | the Nest API GraphQL URL, e.g. `https://<nest>.railway.app/api/graphql` |
| `LABDA_TOKEN` | a Supabase access token the agent acts as (see limitation below) |
| `EVE_BASIC_USER` | `labda` (or your choice) |
| `EVE_BASIC_PASSWORD` | a strong shared secret (the UI proxy sends it) |

Auth: `agent/channels/eve.ts` uses HTTP Basic in production and stays open on
localhost for dev. The UI's `/api/eve` proxy attaches the same credential.

> **Limitation (issue #18):** the agent currently acts as a single
> `LABDA_TOKEN`, not the signed-in researcher. For a single-user or trusted
> deployment that's fine; for multi-tenant, thread the per-request user token
> into the agent before exposing it broadly.

## 5. UI (Vercel)

Env vars on the UI Vercel project:

| var | value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<nest>.railway.app/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_DOMAIN_EVENTS_CHANNEL` | `labda:domain-events` |
| `EVE_URL` | the EVE agent's Vercel URL (server-side; used by `/api/eve`) |
| `EVE_BASIC_USER` / `EVE_BASIC_PASSWORD` | must match the EVE project |
| `NEXT_PUBLIC_JUPYTER_URL` | optional — prefill the remote-kernel field |

The API rewrites `/api/nest/*` → `NEXT_PUBLIC_API_URL` (see `next.config.js`);
`/api/eve/*` is the server-side proxy to `EVE_URL`.

---

## Verify

- UI loads, sign in (Supabase OTP).
- Create a Project → Hypothesis → search literature → attach (Nest + Supabase).
- Open a Protocol → run a cell on Pyodide, then switch Compute to your Jupyter
  URL and run again.
- Ask the Research agent something (UI → `/api/eve` → EVE → Nest tools).
- Export OKF / analysis / download an OA PDF → Supabase Storage signed URLs.
