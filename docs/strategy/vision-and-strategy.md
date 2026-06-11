# Labda — Vision & Strategy

> **Status:** Internal working document. Blunt, decision-focused. Not investor-facing copy.
> **Last updated:** 2026-06-07
> **Companion docs:** [Competitive Landscape](./competitive-landscape.md) · [Field Expansion Map](./field-expansion-map.md)

---

## 0. Thesis (the one filter)

**We are a research-acceleration platform for bioscience. We are NOT a PhD-labor broker for AI labs.**

The community of scientists is the heart. Research-via-API is the service. The training data we generate is a *byproduct we sell to fund the mission*. The destination is **specialized tools that push biology forward faster** — not LLM sycophancy, but real ML: genome segmentation, spatial auto-labeling pipelines, domain-specific models that elevate scientists rather than replace them.

**Decision filter:** any feature that makes us *more* of a labor broker and *less* of a science-acceleration platform is the wrong feature.

### Ethos
- The real work in science is far more complicated than any LLM can handle. We don't pretend otherwise.
- ML's job is to **elevate** scientists: make them faster, surface what they'd normally miss, accelerate discovery.
- We **augment, never replace.** (See §13.)
- Anti-slop. We pay scientists fairly for the expertise that AI currently scrapes for free.
- **Built around the scientific method, in the scientist's own language.** The whole product is organized around the research lifecycle and its real artifacts — hypotheses, protocols, datasets, notebooks, findings, preprints/papers — not generic SaaS abstractions. (Information architecture + ubiquitous language in [Product Direction §8–9](./product-direction.md).)

---

## 1. The layered model

A multi-layered platform built in dependency order. Each layer funds and enables the next.

| Layer | What | Role |
|---|---|---|
| **L0** | Free AI copilot for comp-bio (literature + experiment/analysis planning), ELN grows underneath | Acquire & retain the community |
| **L1** | Marketplace / MCP — commissioned expert research as an async API | v1 monetization engine |
| **L1.5** | Commissioned data, sold to AI labs | High-margin exhaust of L1 |
| **L1.x** | Distributed cross-lab **verification / replication network** | QC engine + mission feature + premium data |
| **L3** | Specialized ML automation per subfield | The moat & the mission payoff (LAST) |

The sequencing **is** the strategy. We come for the tool, stay for the community, monetize via the marketplace, and the data + automation compound into the moat.

---

## 2. Market & beachhead

- **Field:** Bioscience first. (Not horizontal "all researchers" — no shared workflow means no shared tool means no network effect.)
- **Subfield wedge:** **Computational biology / bioinformatics** (single-cell genomics, RNA-seq cluster). Why:
  - The copilot is digital-native and most useful here.
  - These researchers are immediately fulfillable supply for a digital-only marketplace (their work is already in-silico).
  - Their expertise is exactly what AI labs want to buy — supply and demand are the *same* subfield.
  - They're API/MCP-native and will evangelize "research-as-an-API."
- **Expansion:** widen to adjacent / wet-lab-adjacent subfields later. See [Field Expansion Map](./field-expansion-map.md).

### Audience: who, and which side of the market
- **Supply + community + data:** academic **PhD students and postdocs.** They do the actual work, are underserved by software, are chatty early adopters, are a flexible expert labor pool, and their work trends toward shareable/publishable.
- **Tools stay free for them forever.** They have no money; they are not the customer. Monetization is pushed entirely onto the demand side.
- **Industry/biotech** explicitly deferred — they won't share data or join a community, which would kill two of three revenue lines. They re-enter later as *buyers* (Stream B).

---

## 3. The wedge tool (L0)

**Copilot-first, notebook-later — delivered as an AI-native, Jupyter-native science workspace ("VS Code for science").**

The concrete surface is a **forked, beautiful VS Code that is Jupyter-native** (the Cursor playbook applied to science), with the AI copilot built in and the ELN growing inside the notebook. Full direction + UX + build approach in **[Product Direction](./product-direction.md)**; competitor features we borrow and the whitespace we exploit in **[Competitor Teardown](./competitor-teardown.md)**.

- **The copilot delivers value first:** literature/reading + experiment/analysis planning + in-cell coding help for bioinformatics. Low adoption friction — comp biologists already live in VS Code + Jupyter, so they try it tonight; nothing to migrate.
- **The notebook IS the process record.** Code + params + outputs + narrative captured as the user already works = rich, structured process data for free (the data moat — see §5, §10).
- **The ELN grows underneath, inside the notebook** — auto-structured, shareable, forkable entries (the "messy session → clean entry" pattern). We grow *into* the notebook instead of demanding a separate one.
- The copilot also routes the marketplace: it learns who's good at what, and detects stuck-points that become marketplace tasks.

---

## 4. Acquisition

**Utility-led. Earnings as the deepening layer. Hook baited early.**

- Lead with the free copilot's "aha." Trust before transactions — "get paid to do research tasks" from an unknown startup smells like a content mill; a useful free tool builds credibility first.
- A paid marketplace needs demand to exist before supply matters — on day one there are no buyers, so leading with "earn money" burns the relationship.
- From day one, plant a **visible-but-secondary "opt in to get paid for research tasks"** so the labeled supply pool builds before demand arrives.

### GTM motion — bottom-up, community-led, never top-down
- Seed where they already gather: bioinformatics X/Twitter, r/bioinformatics, Biostars, lab Discords/Slacks, ISMB/RECOMB, 2–3 influential comp-bio labs as design partners.
- Lead with the copilot, then the **"we pay scientists fairly for the expertise AI scrapes for free"** manifesto. In a community this broke and this AI-aware, that's a movement, not a pitch.
- Turn the controversial part (data → AI labs) into a **transparency manifesto** — own it loudly; it becomes a trust moat instead of a scandal.
- Individuals adopt. We never sell to the university. Procurement death avoided.

---

## 5. Business model

**Pillars 1 and 2 of the original pitch collapse into one product.**

Passive surveillance-data collection is a legal/ethical minefield (consent, university IP, GDPR). The marketplace solves it for free: **when an AI lab pays to dispatch a task to a PhD via our MCP, the output of that commissioned work IS the high-value training data** — gathered as clean, consented, work-for-hire. We don't sell surveillance logs; we sell actively commissioned expert reasoning and results, and we get paid twice (fulfillment + data rights).

**v1 business = "human expert research as an API."** Data is the exhaust. ML automation is explicitly L3.

---

## 6. The marketplace / MCP (L1)

### Scope: digital-only for v1
- Digital/in-silico: data analysis, bioinformatics pipelines, literature synthesis, annotation/curation, agent-output verification, code, statistical review.
- **Wet-lab work is parked** as a future premium tier. An AI agent's tool call can't wait three weeks for a Western blot; the MCP wedge *only* works for digital deliverables. Wet-lab is an operational swamp (reagents, biosafety, IP, liability) — but eventually our super-moat ("real physical experiments on demand, via API," which no one else can offer).

### Interaction model: async job, "done right, not stupidly fast"
We are not promising millisecond latency — we sell *correct* expert work. The anti-Mechanical-Turk.

- **One backend, two front doors:** MCP for AI agents, a web dashboard for human buyers (biotechs, later).
- **Async job model, orchestrated with Temporal** (durable long-running workflows for the submit → assign → work → QC → deliver lifecycle):
  - `submit_research_task(spec, quality_tier, deadline)` → returns `task_id` immediately (non-blocking).
  - `check_task_status(task_id)` → `queued | in_progress | needs_clarification | complete`.
  - `get_task_result(task_id)` → structured deliverable + **provenance metadata**.
  - **Callbacks/webhooks** on completion so agents don't poll.
  - Optional **fast lane** (sub-hour micro-tasks) vs **deep lane** (multi-day), different SLAs/prices.
- **Structured specs in, schema'd results out** — machine-consumable for agents and for AI-lab data ingestion.
- **Provenance on every result is the product**, not a nice-to-have: which vetted expert, quality tier, consensus/confidence, time spent. This is exactly what anonymous crowd labels (Scale/Surge) lack.

---

## 7. Quality control

**Layered: vetted-expert by default, paid redundancy on demand, reputation feeds routing.**

1. **Vet supply hard up front** — verify identity + credentials (ORCID, institutional email, publication record) + a domain **test task** before paid work. We're a vetted expert network, not a crowd of strangers — this alone avoids the Mechanical-Turk quality collapse.
2. **Per-task verification scales with price/stakes:**
   - Low-stakes/objective → single vetted expert + automated/gold-standard spot checks.
   - High-stakes / data-for-labs → **redundant consensus** (2–3 experts independently; disagreement escalates to a senior reviewer).
   - **Redundancy isn't our cost — it's a product tier.** "Single expert" / "consensus-verified" / "senior-reviewed" are priced quality tiers the buyer chooses, matching exactly how AI labs already think about data.
3. **Reputation feeds routing** — every task scores the expert; high-reputation experts get more/better-paid work and lighter oversight. This reputation data also powers L3 automation (we know who's reliable at what).

---

## 8. Verification / replication network (L1.x)

**"Another pair of eyes never hurt nobody" — global, distributed peer-review of experiments and findings.**

The same consensus/redundancy machinery from §7, pointed *outward* and sold as a product. Peer-review or replicate an experiment/thesis via different wetlabs/researchers across the world.

Why it's a first-class pillar:
- **Mission:** directly attacks bioscience's **reproducibility crisis** at scale. Movement-grade value prop, deeply on-brand.
- **QC engine, externalized:** it *is* our consensus mechanism, sold as a feature.
- **Highest-value data of all:** AI labs want *grounded, verified* signal, not more text. Replication outcomes (confirmed / refuted / conditions-dependent) are among the rarest, most valuable training data in existence — this makes our exhaust uniquely good.
- **Distinct demand:** researchers, journals, and biotechs paying to validate findings before they publish/invest (slots into Stream B).

---

## 9. Demand & cold-start

The branch that quietly kills marketplaces. We have clean supply (free tool → vetted experts); we must manufacture demand before it exists.

- **First buyer = 1–3 AI-lab design partners** (not biotechs). They have budget allocated *now* for expert data / RL environments / agent-output verification, buy in volume, and tolerate a rough early product if expert quality is high. Biotechs are demand-stream #2 (slower, bespoke, lower volume).
- **Break the cold-start by being our own first buyer:**
  1. **Self-fund a trickle of paid tasks from day one** — makes the "earn money" promise true immediately, seeds reputation/quality data, and produces a curated **sample data batch**.
  2. **Use the sample batch as the sales asset** — "here are 200 verified bioinformatics reasoning traces, want 50,000?" beats a pitch deck.
  3. **The free copilot is insurance** — independently useful, so supply doesn't churn while we close demand.

Sequence: free tool builds engaged supply → self-funded trickle proves earnings + generates sample data → sample data closes design partners → demand scales → flywheel spins.

---

## 10. Legal / IP / consent

The landmine that can collapse *supply* overnight. Three design rules — baked into the product, not just the ToS:

1. **Tasks use buyer-provided or synthetic inputs — NEVER the expert's own lab data.** The task is "apply your RNA-seq *expertise* to *this dataset we hand you*," not "bring your lab's unpublished results." This single rule severs the university-IP entanglement entirely, and keeps unpublished science from leaking. **This shapes what tasks can even exist.**
2. **Personal freelance work, off-the-clock, on personal equipment**, with explicit work-for-hire assignment + data-license consent accepted **per task**. Real ToS, real lawyer, steer clear of the messiest jurisdictions early.
3. **Radical transparency as the ethics shield.** "Your work may be used to train AI models. You're paid for it. Here's the rate." Opt-in, paid, transparent. The backlash story only exists if it's hidden — leaning in makes it a *recruiting* message.

### GDPR flag (EU entity → US AI-lab buyers)
We're a Polish/EU entity collecting expert-generated data and selling it to US AI labs — a cross-border personal-data-and-IP transfer. Manageable (the work-for-hire + per-task consent already handles most of it; task *outputs* needn't contain personal data), but **explicit in the legal section, not an afterthought.**

---

## 11. Pricing & unit economics

**Two revenue streams per task. Pay experts well. Pay fast.**

- **Buyer price = complexity × quality tier × turnaround.** The quality tier (single / consensus / senior-reviewed) is the main price lever.
- **Pay experts generously — that's the entire magnet.** Target ~$25/hr in the Polish/EU context (very attractive vs. a ~€1,000–1,500/mo PhD stipend; the floor for "eyes light up" is low). **Pay fast** — instant/weekly payout is a huge retention lever for this demographic.
- **Two streams per task:**
  1. **Service take rate** — ~20–30% on fulfillment (standard expert-marketplace economics).
  2. **Data-licensing revenue** — the AI lab pays *separately* for rights to the work-for-hire output as training data. High-margin, and long-term **where the real money is.** Fulfillment can run near break-even while the data license is the profit engine.

---

## 12. Moat / defensibility

**The moat is NOT the marketplace — the marketplace is commoditizing fast** (Mercor, Surge, Scale, in-house lab networks). If we launch as "just a better expert marketplace," we lose to Mercor. The moat is the three things wrapped around it:

1. **The free copilot + community owns the daily workflow.** Brokers have no daily-use product and must re-acquire labor constantly. We have a standing, engaged community loyal to a *tool they use every day* — near-zero re-acquisition cost and real loyalty. **We own the relationship; they rent it.**
2. **Vertical depth beats horizontal breadth.** Scale is a mile wide, an inch deep. We go deep in comp-bio — better vetting, task design, domain QC and tooling — and become *the* trusted home for verified bioscience expertise.
3. **Data → automation cost flywheel.** Observing workflows lets us build L3 automation that makes experts more productive and absorbs commodity tasks — driving marginal cost *below* a pure broker's. The marketplace teaches us what to automate; automation lowers cost; lower cost wins. Compounds. A broker with no tool and no workflow data can't start this flywheel.
4. **Brand/ethics moat.** "By scientists, for scientists, paid fairly, fully transparent" — a community-owned ethos a faceless labor broker literally cannot copy.

**Public positioning rule:** never position as "an expert marketplace." We are "the comp-bio research platform that happens to pay you."

---

## 13. The augment-vs-replace endgame

The cannibalization tension this model forces: L3 ML tools are designed to automate the very tasks the community gets paid for. Fumble it and the automation reads as "you trained the AI that took our side income," and the community-trust moat implodes exactly when it should be paying off.

**Stance: augment, explicitly and structurally — never replace.**

- **Automate the boring 80%, elevate scientists to the valuable 20%.** ML handles commodity/repetitive sub-tasks; scientists move up to supervise, curate, validate, and own the novel/hard work — earning *more per hour* because their time is leveraged. The marketplace evolves from "humans do tasks" → "humans supervise and improve AI doing tasks." Higher margin for us, higher pay for them.
- **Humans-in-the-loop stay structurally essential** — frontier/novel work and model QC always need experts. The flywheel never removes them; it promotes them.
- **Contributor revenue-share / credits.** Experts whose work trained a tool get a stake in it (royalty, credits, equity-like upside). The community-ownership ethos made real — and the thing no labor broker can ever credibly offer, so it *deepens* the moat precisely as automation arrives.

One-liner: **"We automate the drudgery so scientists do — and get paid for — the science that matters, and they share in the tools they built."**

---

## 14. Roadmap & MVP sequencing

**Discipline: build the tool for real, fake the marketplace by hand until the loop is proven, then productize. Never build an ML automation for a bottleneck we haven't personally watched the marketplace grind through.**

1. **v0 — free comp-bio copilot**, narrow and excellent. Earnings hook present but quiet. Goal: engaged, loyal community. *(~mo 0–6)*
2. **Concierge marketplace — fake it before you build it.** Before a line of marketplace/Temporal/MCP code, fulfill tasks **manually**: founders hand-match experts to self-funded + 1–2 design-partner tasks over email/Slack/spreadsheet. Validates earnings loop, QC, data quality with *zero* engineering, and produces the sample batch. *(~mo 3–9, overlapping)*
3. **Productize only what concierge proved:** Temporal async backend → MCP integration → buyer dashboard. Close the AI-lab design partner with the sample batch. Turn on the data-license line. *(~mo 9–15)*
4. **First specialized ML tool** in a bottleneck we've now watched dozens of times (L3). *(12 mo+, gated on understanding the industry — see §15)*

---

## 15. Cash-stream activation (capability-gated, not calendar-gated)

Two "streams" actually turn on as one event: for an AI lab, the commissioned research *is* the data. "Paid research" and "data for AI labs" are one deal, one buyer.

**Phase 0 — Community (mo 0–6) · Revenue $0**
Free copilot only. We're spending (self-funded seed tasks); the paid-research loop is LIVE but founder-funded — validation, not revenue. Concierge, no marketplace code.
→ *Gate:* vetted supply pool (dozens of experts) + proven QC + curated sample batch.

**Stream A — Commissioned research + data license (AI labs) · first external revenue · mo ~6–9**
Sample batch closes 1–3 AI-lab design partners. Two line items: service margin + data license. Concierge-fulfilled at first.
→ *Gate:* manual fulfillment hits capacity ceiling; loop economics proven.

**Productization (mo ~9–15) · scales Stream A**
Build Temporal + MCP + dashboard. Amplifies Stream A; opens self-serve. No new stream.

**Stream B — Research-via-API for companies/biotechs (their own use) · mo ~12–18**
Biotechs buy outputs for themselves (service margin only — they own it, no data resale). Plus verification/replication demand. *Gate:* productized platform + brand/trust + ability to handle confidential buyer inputs.

**Stream C — Specialized ML tools · LAST**
Highest-margin, product/SaaS. **Explicitly last — gated on deeply understanding the industry**, not on a calendar. *Gate:* enough observed workflow data in one bottleneck to ship a model that beats manual.

Cash-on sequence: **$0 (community) → A (AI-lab research+data) → B (biotech research-via-API) → C (ML tools, last).**

---

## 16. Capital & team

- **Team:** 3 founders — CTO, co-founder designer, junior frontend/ML researcher. Technical enough to build the copilot. Unpaid ~6 months (sweat equity + side hustles).
- **Base:** Poland. Low burn; $25/hr expert rate gets strong PhD traction; raises stretch ~2–3× vs. US.

### Phase 0 — founder-funded (mo 0–6)

| Item | Rough cost |
|---|---|
| Founder salaries | ~$0 (sweat equity) |
| LLM/infra | ~$10k |
| Seed-task pool (~400–500 tasks @ $25/hr) | ~$15–25k |
| Legal/IP/ToS + GDPR + incorp | ~$10–15k |
| **Total founder capital** | **~$35–50k** (~$40k comfortable) |

### Pre-seed raise (after Stream A proven, mo ~6–9)
- **Target ~$500k** (push higher opportunistically), 18–24 months at low Polish burn. Covers modest salaries for 3 + 1–2 productization hires + scaled seed/ops + GTM.
- **Non-dilutive in parallel:** NCBR, PARP, EU Horizon Europe / EIC Accelerator, deep-tech accelerators (often €50k–€500k+). Reinforces the "for science" brand; reduces dilution.

**Shape:** ~$40k own capital → prove Stream A on sweat + seed pool → raise ~$500k pre-seed (+ aggressive EU grants) → 18–24 mo to productize and scale.

---

## 17. Open risks (to expand)

- **AI labs build in-house expert networks** → hedge: community + tool ownership they can't replicate; be the trusted aggregator.
- **Demand concentration** (few AI-lab buyers) → diversify into Stream B (biotechs, journals, verification) early once productized.
- **Competitor (Mercor/Surge) moves into bio** → moat is community + vertical depth + flywheel, not mechanics (§12).
- **Supply churn** if earnings feel exploitative → fair pay, fast payout, transparency, contributor revenue-share (§13).
- **Ethics backlash** → radical transparency, "fair pay for science," augment-not-replace (§10, §13).
- **GDPR / cross-border data** → §10.
- **University IP claims** → buyer-provided-inputs-only rule (§10).

---

## Appendix — decision log (resolved branches)

| # | Branch | Decision |
|---|---|---|
| 1 | Beachhead | Bioscience first (not horizontal) |
| 2 | Audience | Academic PhDs/postdocs as supply; monetize demand side; tools free forever |
| 3 | Subfield wedge | Comp-bio / bioinformatics |
| 4 | Wedge tool | Copilot-first (lit + experiment planning), ELN later |
| 5 | Acquisition | Utility-led; earnings as deepening; hook baited early |
| 6 | Business model | Research-as-API; data as exhaust; pillars 1+2 merged; ML = L3 |
| 7 | Marketplace scope | Digital-only v1; wet-lab parked |
| 8 | QC | Vetted-expert default + paid redundancy tiers + reputation routing |
| 9 | Verification | Cross-lab replication network as first-class pillar |
| 10 | Demand cold-start | AI labs first; self-fund seed; sample batch closes design partners |
| 11 | Legal/IP | Buyer-provided inputs only; work-for-hire; radical transparency; GDPR explicit |
| 12 | Product architecture | Async job; Temporal; MCP + dashboard; provenance on every result |
| 13 | Pricing | Two-stream (service take + data license); pay well/fast |
| 14 | Moat | Community + vertical depth + automation flywheel + brand; never "a marketplace" |
| 15 | MVP sequencing | Copilot → concierge → productize → ML tools |
| 16 | Cash gating | $0 → A → B → C (C last, industry-gated) |
| 17 | Endgame | Augment not replace; contributor revenue-share |
| 18 | Capital | ~$40k founder + ~$500k pre-seed (+ EU grants); PL base; team unpaid ~6 mo |
