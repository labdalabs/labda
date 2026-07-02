# PDR-002 — Architecture & Open-Core Build Stack

> **Status:** Decided (build-direction grilling, 2026-06-17). Sets the engineering posture and the building blocks for v0.
> **Companion docs:** [PDR-001 — L0 Build Approach](./pdr-001-l0-build-approach.md) · [Product Direction](./product-direction.md) · [Vision & Strategy](./vision-and-strategy.md) (§6 business model, §10 legal/consent, §11 pricing) · [Instrument Integrations](./instrument-integrations.md)
> **Last updated:** 2026-06-17
> **Owner:** CTO

---

## 1. Decision

**Build open-core, in public, on top of proven open-source infrastructure — not from scratch.** The model is **PostHog / Supabase**: a fully-open core anyone can run with one command, a hosted version we operate, premium bits under a separate restrictive license, and everything (code, docs, site) developed in the open.

The throughline: **our IP is not the plumbing — it's the harness, the workflow, the community, and the convenience.** We don't reinvent databases, auth, vector search, workflow engines, or chat UIs. We assemble best-in-class OSS, build the science-specific layer on top, and license it so a hyperscaler can't simply re-host our work.

This is a deliberate bet, copied from companies that won crowded markets *not* by being first but by being open, transparent, and convenient (PostHog entered a 15-year-old analytics market behind Amplitude/Mixpanel and raised at scale anyway).

---

## 2. Why open-core / build-in-public

- **Trust & community.** Public code, public docs, public roadmap reads as "by researchers, for researchers" — the exact brand the [strategy](./vision-and-strategy.md) §12 stakes out. People contribute plugins and integrations, file issues, and feel ownership.
- **"Stolen" is a non-threat.** A permissive-but-no-compete license plus the reality that anyone determined could reverse-engineer us means secrecy buys little. We're not inventing new particles — we're building a convenient harness. Openness buys far more (trust, contributions, adoption) than it costs.
- **Cheapest possible start.** Standing on Supabase/n8n/Postgres means v0 infrastructure cost is ~nothing and we can ship *tomorrow*. (Worst case, a dedicated Mac Mini runs the first instance; realistically Supabase's ~$25/mo tier carries us well past first users.)
- **Give-back compounds.** When we solve something un-addressed (e.g. a Python shim for a specific microscope/instrument), publishing it as an OSS plugin earns goodwill *and* pulls the community toward our tool. We lose nothing.

---

## 3. The three products (and their licensing posture)

We ship one coherent system, but it factors into three products with different openness:

| # | Product | What it is | Posture |
|---|---------|-----------|---------|
| **1** | **The tool** | Client (VS Code plugin / webview app, per PDR-001) **+** a backend service **+** workers that run workflows | **Open core.** Core fully open; premium features under a restrictive license (Enterprise Edition). |
| **2** | **The marketplace** | Auth/ORCID-gated platform where vetted researchers receive and execute commissioned tasks *in our tool* | **Closed source.** No public visibility into matching, pricing, or the data pipeline. |
| **3** | **Data licensing** | Selling consented, work-for-hire process data + verified outputs to AI labs | **Hosted-only, explicit-consent path** (per PDR-001 §15 and strategy §10). Never free-tier-by-default. |

The tool is the open magnet. The marketplace and data lines are where we monetize, and they stay closed — they're compatible with the tool *by design* (marketplace tasks are authored to run in our software), but the tool stands alone and free without them.

---

## 4. Repo & licensing structure

- **Nx monorepo.** One repo, many packages. Inspired directly by how PostHog/Supabase lay theirs out — we'll mirror a proven structure rather than invent one.
- **Per-directory licensing.** A folder carries its own `LICENSE`. The **`core`** is open; an **`ee/` (Enterprise Edition)** folder holds premium plugins/features under a separate, restrictive license. This is exactly the PostHog pattern (most of the repo open; `ee/` gated).
- **No-compete-hosting clause.** The premium/source-available license must forbid offering Labda *as a hosting service* — the Redis/MongoDB/n8n lesson (AWS re-hosting OSS without giving back is what triggered Redis→Valkey/SSPL and Mongo→SSPL). Self-hosting for your own lab is explicitly fine and even encouraged (consulting/support upside).
- **Build in public, site included.** Docs and the marketing site can live in the same public repo (PostHog does). The license makes duplication pointless; openness makes us approachable.

> **Open follow-on:** pick the exact core + premium licenses. Candidates to evaluate: **AGPL** or **SSPL** or **BSL** (source-available, time-delayed open) for the no-compete posture; **n8n's Sustainable Use / Fair-Code** license as a reference. Decide before the repo goes public.

---

## 5. The stack (chosen building blocks)

Default to existing OSS; build only the science-specific layer ourselves.

| Layer | Choice | Why | License / note |
|---|---|---|---|
| **DB + auth + storage + realtime + vectors** | **Supabase** (Postgres, `pgvector`, Auth, Storage, Realtime) | One open platform gives us everything: auth, the database, file storage, realtime, and vector search for embeddings — runnable locally *and* hosted. Cheapest, fastest path. | OSS; self-hostable. Some features hosted/EE-only. |
| **User-facing workflow engine (the canvas)** | **n8n** | Node-based, user-buildable workflows; custom inputs/outputs; cloud integrations. We embed it as the engine behind the visual **canvas** (see [Product Direction](./product-direction.md)). | Sustainable-Use license — usable as long as we don't offer it *as hosting*. **Confirm data-model extensibility** for custom science blocks. |
| **Durable orchestration** | **Temporal** | For long-running, multi-day, human-in-the-loop sagas (marketplace tasks, setup flows that "wait for feedback for days"). The "long tasks" the [strategy](./vision-and-strategy.md) describes. | OSS; self-hostable. Likely *not* needed in earliest v0. |
| **Realtime collaboration / versioning** | **Yjs** (CRDT) | Same conflict-resolution/merge approach Notion uses; precise change tracking + auditability; stores as binary in Postgres. Demo-proven in ~3 weeks of prior work. | OSS. |
| **Project/file versioning** | **git (standalone)** | Versioned project repos; we can keep git state in Postgres rather than coupling to GitHub. **LFS** for large binary files (images). | Use git as a server, not a GitHub integration. |
| **Artifact storage** | **Supabase Storage / S3** | Images and large artifacts. | — |
| **Chat / copilot UI** | **assistant-ui** | OSS (YC-backed) component framework for AI chat UIs; adapter pattern lets us host chat history on our own backend. CTO is a contributor; battle-tested in a prior product. | OSS (MIT-style). |
| **Analytics** | **PostHog** | Product analytics, self-hostable; also our build-in-public role model. | OSS / open-core. |
| **Vision models** | **YOLO / SAM / Cellpose-class** | Semi-automatic cell counting/segmentation & viability (see [Instrument Integrations](./instrument-integrations.md) and [Field Expansion Map](./field-expansion-map.md) §1). | OSS (MIT/Apache). |
| **AutoML (premium block)** | SageMaker-style AutoML | A canvas block that trains simple classifiers/regressions from a user's datasets + a stated goal (see §6). | Premium; guarded (§6). |

**Principle:** every box above is something proven, open, and permissively licensed. We are the integrator and the science layer — not the inventor of the substrate.

---

## 6. AutoML as a premium block (and its guardrail)

A planned premium feature: a **canvas block that does light AutoML** — the user supplies datasets + a goal ("correlate this dataset against that one"), and we train a simple model (classification, linear regression) semi-automatically, no ML engineer required.

- **Precedent (why we believe it works):** at Sohar Health, a SageMaker AutoML model trained on two datasets (patient inputs → billed-or-covered outcomes) hit ~97–98% accuracy and replaced a brittle 500-`if` heuristic for insurance-eligibility prediction — with a manual-verification fallback when confidence was low. The same shape (two datasets in → probability out, human fallback on low confidence) maps onto bench data.
- **Guardrail (Paweł):** *don't use ML when it isn't needed.* If an algorithmic/deterministic approach solves it, that's 3× better than a model that only approximates. Non-expert users will request models for things that need none — so the feature must triage requests and steer them to the simplest correct tool.
- **Possible later branch (Paweł):** a separate **"ML Studio"** that publishes open-source models to HuggingFace (Google offers compute credits for OSS training). Users request a model; if it's worth building, the studio builds it and releases it. This is a *later, bigger-scale* move — v0 starts smaller, with models that help users' own daily work inside their own repository.

---

## 7. Self-host vs hosted, auth & cost control

- **Community Edition:** the open core, installable with **one `docker-compose`** (the PostHog CE pattern). Run it free, locally, forever.
- **Hosted free tier:** zero-friction — install the plugin, panels open, look around with **no signup**. Auth (Supabase **OTP**: email → code → in) only when you first touch an **AI feature**, because *we* pay for inference (strategy §16 budgets ~$10k for phase-0). Per-account rate limits are the real cost lever; **BYO-key** is the escape valve for power users. (Mirrors PDR-001 §14.)
- **Enterprise Edition:** premium features available only on our hosted version or a properly-licensed self-host — plus the consulting/support/installation upside for labs without a modern IT/devops team (a common gap).

---

## 8. Constraints & open follow-ons (engineering hand-off)

1. **n8n data-model extensibility** — confirm we can specify custom inputs/outputs/integrations and custom science blocks; if it's too rigid, build a minimal canvas engine ourselves (a node graph with forms + edges is not the hard part) or adopt an open job-schema standard.
2. **Core + premium license choice** — resolve §4's open follow-on before the repo is public.
3. **Compute model** — local vs hosted vs remote-user-cluster kernels, entangled with PDR-001's remote-SSH must-have (§8/§17 there). The hosted path is where data capture and reproducible task execution are clean.
4. **git storage / LFS strategy** — how project repos + large image files are stored (Postgres-backed git state vs. a git server; LFS sizing).
5. **Webview-app portability** — keep the secret-sauce in a portable webview so the plugin can migrate to a standalone app or hosted browser-VS-Code later (PDR-001).
