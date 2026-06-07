# Competitor Teardown — what to borrow, where the openings are

> **Companion to** [Vision & Strategy](./vision-and-strategy.md) and [Competitive Landscape](./competitive-landscape.md). Internal.
> **Lens:** features worth borrowing + gaps we can exploit.
> **Sourcing:** web research, June 2026. Pricing/features change fast and some pricing pages block bots — figures are directional, corroborated from multiple sources where the live page was inaccessible. **Fact-check before any external use.**
> **Last updated:** 2026-06-07

Covered: **AI research tools** (Elicit, Consensus, SciSpace, Scite, Semantic Scholar) · **Lab notebooks** (Benchling, protocols.io, SciNote, Labguru, LabArchives) · **Verification** (OSF, ResearchHub).

---

## Executive synthesis — read this first

### The 8 things worth stealing (ranked by value to us)

1. **"Messy input → structured entry" agent — own it for comp-bio.** The convergent winning ELN pattern: Benchling *Compose*, Labguru *Protocol Converter*, SciNote *Manuscript Writer* all monetize turning scattered notes/data into structured records. **None does it conversationally or for *computational* work (code, dataframes, pipelines, runs).** Make the ELN entry a *byproduct* of the copilot session — this **is** our copilot→notebook growth path, in an open lane.
2. **Capture research-*process* data, not just documents.** protocols.io "run records" (what was *actually* done vs. intended, with deviations + timestamps) and Dotmatics' "structured data captured at point-of-work" both confirm structure-at-source is what makes AI trustworthy *and* what makes our data moat. Incumbents store final documents; we silently log the process (queries, params, intermediate results, dead-ends).
3. **Adopt SCORE's three-axis verification schema as our product spec.** OSF/COS's DARPA SCORE program (3,900 papers, Nature-published) verifies along **reproducibility** (same data/analysis) / **robustness** (alt analysis, same data) / **replication** (new data), emitting a **per-claim quantitative confidence score**. That score is exactly the unit an AI lab buys. Don't invent a schema — adopt this validated one.
4. **Pay fiat, keep the openness multiplier.** ResearchHub proved scientists *will* do paid verification — but its **RSC token collapsed ~94%** from ATH, making "$150" rewards unreliable and inviting gaming. Steal its best mechanic — **2× reward for preregistration, 3× for open data/code** (which directly lowers *our* verification cost) — and **pay in fiat/fiat-pegged**, not a speculative token.
5. **Provenance at the finest grain is table stakes.** Elicit's click-a-cell→see-the-exact-source-sentence is the best trust UX in the category; Scite, Consensus, Semantic Scholar all win on the same axis. Extend it past papers to *process*: every suggested parameter/method/line of code links to where it came from and is independently verifiable. This is also the antidote to the hallucination complaints that dog *all five* AI tools (fake DOIs in Scite, "misreads a number" in Elicit).
6. **Structured extraction + visual aggregation beat chat.** The most-loved features aren't chatbots: Elicit's papers-as-rows extraction tables, Consensus's yes/no/maybe **Meter**, Scite's supports/contrasts/mentions tags. Borrow as comp-bio primitives — extraction tables over methods papers, a "consensus/replication meter" over methodological choices.
7. **Forking + version-diffing + citable DOIs as a growth loop.** protocols.io's forkable, diffable, citable public protocols are the best academic acquisition mechanism in the set — citations pull in new users, a public commons feeds the AI. Make every copilot-produced pipeline forkable/diffable/shareable → seeds the marketplace/commons none of them have.
8. **Stand on Semantic Scholar, don't rebuild the corpus.** Elicit and (partly) Consensus build on its free Academic Graph API (~200M papers, citations, TLDRs). Use it as our literature backbone; spend engineering on comp-bio differentiation + the marketplace.

### The openings nobody occupies (our whitespace, confirmed)

- **No one connects to paid human expert work.** All 12 tools are software-only or reputation-only. Our marketplace is a clean differentiator.
- **No one productizes research-process data.** Even SciSpace, which generates reproducible workflows, doesn't capture/sell the exhaust.
- **On-demand, paid, cross-lab verification does not exist.** OSF has the methodology but only multi-year, grant-funded, project-based replication (and mostly social science). ResearchHub has a paid marketplace but it's *prose peer-review of preprints*, not running experiments in a second lab. **The hardest, most valuable thing is unbuilt.**
- **Structured, machine-usable verified-outcome data is unowned.** Both verification platforms treat verified data as a byproduct/benchmark — COS's own LLM-benchmark work *explicitly is not selling data to AI labs*. We productize what they treat as research.
- **Computational biologists / grad students are badly underserved by ELNs.** Every incumbent's data model is wet-lab-shaped (sequences/samples/plasmids), the real AI is gated behind enterprise, and protocols.io's 700% price hike triggered cancellations.

### ⚠️ Two threats that update [Competitive Landscape](./competitive-landscape.md)

Our landscape doc says "everyone owns a slice, no one owns the loop." Still true — but two incumbents are now *moving toward the loop* and must be watched:

- **SciSpace shipped a "BioMed Agent" (2025)** — an AI co-scientist orchestrating 100+ biology tools, claiming multi-omics, variant prioritization, CRISPR design, drug-property prediction. It's the closest existing analog to our L0 thesis. **But it's brand-new, broad-claimed, and unproven at the bench.** Our wedge: be the tool that genuinely *executes and verifies* comp-bio work reproducibly, not the one that demos well. Treat SciSpace as the competitor to out-execute.
- **Benchling went AI-native + MCP (Oct 2025)** — three agents (Deep Research, Compose, Data Entry), in-platform AlphaFold/Chai-1/Boltz-2, **and a Benchling MCP** so external agents can query Benchling data. Dotmatics/LabArchives announced a similar **Luma Agent** (May 2026). The incumbents are racing to AI-native + MCP — but their data models remain wet-lab/industry-shaped and their AI is enterprise-gated, leaving the free, comp-bio-native, bottom-up lane open. **The MCP-as-integration move validates our architecture; speed matters.**

---

## Category 1 — AI research tools

*Elicit · Consensus · SciSpace · Scite · Semantic Scholar*

### 1.1 Elicit
- **What:** AI research assistant for literature/systematic reviews over ~138M papers (sourced from Semantic Scholar) + ~545K clinical trials. The serious SR tool.
- **Core:** semantic search; **papers-as-rows extraction tables** (user-defined columns, screen 1k–40k papers); true **systematic-review pipeline** (inclusion/exclusion thresholds, **pilot-before-full-run**, PRISMA on Enterprise); **cell-level provenance** (click a cell → exact source sentence); async background jobs; Research Agent reports.
- **Borrow:** click-to-source-quote provenance · pilot-extraction-then-scale · structured extraction tables as primary output (not chat) · async notify-on-complete.
- **Pricing:** Free (2 reports/mo, 2-col tables) · Pro $49/mo (5k-paper SR, 20-col, API) · Scale $169/mo · Enterprise custom.
- **Gaps/openings:** **literature-only — runs no analyses, touches no data, executes no code.** Admits hallucination/nuance risk ("draft data must be reviewed"). No marketplace, no process-data capture. Differentiated SR power is expensive → room for a free "good-enough" extractor.

### 1.2 Consensus
- **What:** AI academic *search engine* ("not a chatbot") over ~220M records (OpenAlex + Semantic Scholar + publisher full-text). Strong in evidence-based medicine. $30M Series A May 2026, 10M+ users.
- **Core:** **Consensus Meter** (yes/no/possibly aggregate over top ~20 papers, reranked by citation + study design); **Deep Search** (reads dozens of papers → structured report); **Medical Mode** (clinical corpus); strict "summarize only retrieved papers" anti-hallucination design.
- **Borrow:** the **Meter** (visual at-a-glance aggregate answer) → a comp-bio "consensus/replication meter" over methodological choices · **rerank by rigor** (study design, has-code, has-data, sample size), not just relevance · **domain mode switching** → a native "Comp-Bio Mode."
- **Pricing:** Free · Pro ~$10/mo · Deep ~$45/mo · 40% student discount · Enterprise (SAML/Shibboleth + API).
- **Gaps/openings:** explicitly "snapshots, not comprehensive" → weak for true SR. Optimized for yes/no questions, not "analyze my data." Zero comp-bio specificity. No marketplace, no process data.

### 1.3 SciSpace (formerly Typeset) — *closest conceptual competitor*
- **What:** "AI for research" super-platform (280M+ papers): search, chat-with-PDF, lit review, AI writer, and an **AI research super-agent orchestrating 150+ tools** — now with a dedicated **BioMed Agent / "AI co-scientist."**
- **Core:** chat-with-PDF (source-highlighted answers); Elicit-style extraction columns; super-agent chaining 150+ tools; **BioMed Agent** on a "unified biomedical action space" (100+ biology tools) claiming multi-omics, variant prioritization, drug-property prediction, CRISPR design, lab-protocol reasoning, reproducible end-to-end workflows.
- **Borrow:** the **action-space + tool-orchestration agent model is essentially our L0 thesis** — study closely; key UX lesson is to **expose the plan/tool-chain**, not just the answer · general agent → vertical agent validates our "general copilot that specializes into comp-bio" framing · reproducible-workflow framing (lean harder: capture exact code/params/versions).
- **Pricing:** Free (limited) · Premium ~$12–20/mo · Lab ~$100/mo (5+). BioMed Agent positioned premium/enterprise.
- **Gaps/openings:** **breadth-over-depth "kitchen sink"** dilutes trust. **BioMed Agent is new and unproven at the bench** — broad claims, real users will test whether it *runs correct analyses or just narrates*. **Our opening: genuinely execute + verify, reproducibly.** No marketplace / no paid-human layer. Process-data capture is incidental, not productized.

### 1.4 Scite
- **What:** citation-intelligence platform built on **Smart Citations** (every citation tagged supporting / contrasting / mentioning, with the in-context sentence). 1.6B+ citation statements, ~2M users.
- **Core:** stance-classified citations; **claim-level citation-statement search**; citation chaining + network viz; **contradiction alerts/dashboards**; browser-extension overlay on journals/Scholar.
- **Borrow:** **stance classification** → classify whether a citing paper *replicated / failed to replicate / extended* a method (gold in a reproducibility crisis) · **claim-level search** ("has anyone contradicted that X normalization inflates Y?") · **contradiction alerts** → "a method in your pipeline was just flagged as failing to replicate" · **browser-overlay** distribution (augment existing reading flow, low friction).
- **Pricing:** thin free tier · Personal $12–20/mo (almost everything useful gated here) · Org custom.
- **Gaps/openings:** **misclassification + hallucination complaints** (fabricated quotes, fake DOIs); coverage gaps in niche fields/preprints; unpolished/slow UX; billing complaints. No comp-bio specificity, no analysis, no marketplace.

### 1.5 Semantic Scholar — *infrastructure, stand on it*
- **What:** free AI academic search + scholarly knowledge graph from Allen Institute for AI (~200M papers). The **underlying corpus** Elicit and partly Consensus build on.
- **Core:** influential-citation ranking; **TLDR** one-line summaries; **Semantic Reader** (in-line citation cards, skimming highlights); **Research Feeds** (rate-to-learn recommender + email digests); shareable public folders; **free Academic Graph API** (most generous in the category).
- **Borrow:** **use the free API as our literature backbone** (don't rebuild the index — Elicit didn't) · Research Feeds' **rate-to-learn loop** (learn each user's organism/assay/method interests → push relevant bioRxiv preprints; cheap retention) · Semantic Reader's **in-line augmentation** (copilot help *inside* the paper, not a separate chat) · one-click public-folder sharing.
- **Pricing:** free, including the API (rate-limited).
- **Gaps/openings:** coverage gaps (missing Scopus venues, weak books/patents); infrastructure not workflow — stops at discover+read+recommend; no verticalization, no analysis, no marketplace. The lesson is to **stand on it, not compete with it.**

---

## Category 2 — Lab notebooks (ELN)

*Benchling · protocols.io · SciNote · Labguru · LabArchives*

### 2.1 Benchling — *the industry incumbent, now AI-native*
- **What:** dominant cloud R&D platform for **industry/biotech** (ELN + molecular biology + registry + inventory + workflows), with a free academic tier as a funnel into paid commercial seats.
- **Core:** 7 integrated apps; best-in-class molecular biology (sequence editing, CRISPR/primer design, plasmid maps); structured **Registry**; compliance/audit. **Benchling AI (Oct 2025):** Deep Research / **Compose** / Data Entry agents + in-platform **AlphaFold/Chai-1/Boltz-2**. **Benchling MCP** exposes data to external agents. AI free for academics.
- **Borrow:** **Compose Agent** ("scattered files/notes/handwriting → polished entry") is *the* most relevant pattern — the ELN entry as a byproduct of an AI step · Deep Research fusing **private experimental data + public literature** · **predictions next to data** (collapse simulate↔experiment loop) · **MCP as the integration story** (expose notebook as MCP vs. N bespoke integrations) · structure-at-point-of-work is what makes the AI verifiable.
- **Pricing:** **Academic free** (ELN + mol-bio + CRISPR; **excludes Registry/Inventory**) · Professional ~$20K/yr min + $10–20K setup · Enterprise up to **$1M+**.
- **Gaps/openings:** **notorious pricing escalation + lock-in** ("Ticketmaster of biotech software"); **painful academic→commercial migration** (the free tier is a trap on spin-out); heavy/slow at scale; **data model is wet-lab entities, not code/pipelines/runs → comp biologists underserved.** No marketplace.

### 2.2 protocols.io — *"GitHub for methods," now publisher-owned*
- **What:** write/run/version/**publish citable protocols**. Strong in academia/open science (Nature Protocols partner). Acquired by **Springer Nature (2023)**.
- **Core:** interactive recipe-style protocols; **dynamic run mode** with a **timestamped record of what was actually done** (= lightweight process data); **version control + forking + diffing**; **DOI assignment** (citable, archived); public/private sharing; threaded comments.
- **Borrow:** **forking + version-diffing** (start from someone's pipeline, adapt — a marketplace/commons primitive) · **run records** capturing *intended vs. executed* (exactly our process data) · **DOI/citability as a growth loop** (free, discoverable, pulls users via citations) · public library as an AI corpus.
- **Pricing:** Open Research free forever (public protocols) · Premium (private/teams) custom · academic waiver. **Reported 700%+ subscription hike for 2025** post-acquisition.
- **Gaps/openings:** price hike triggered **institutional revolt** (Edinburgh *cancelled*) → a **free, AI-native alternative is well-timed**; not an ELN (protocols only → fragmentation); **not AI-native**; publisher ownership breeds open-science distrust; weak on *computational* "protocols" (code + params).

### 2.3 SciNote — *open-source, academic-leaning*
- **What:** open-source (MPL-2.0) ELN "by biologists for biologists" — notebook + protocols + inventory + compliance; paid compliant cloud for regulated labs.
- **Core:** Projects→Experiments→Tasks; **visual project canvas** (non-linear workflows); protocol repository + templates; flexible inventory; 21 CFR Part 11 / GLP-GMP compliance; integrations (Office, protocols.io, instruments); **AI Manuscript Writer** (structured data → paper draft in 1–24h).
- **Borrow:** **Manuscript Writer** (structured notebook data → paper draft; better-structured work → better draft — a virtuous loop we can do far better with modern LLMs) · **open-source as a trust/adoption wedge** (consider an open core) · visual non-linear canvas · templates lower activation cost.
- **Pricing:** OSS self-hosted free · Cloud no free tier (14-day trial), per-user custom quotes · free cloud account caps Manuscript Writer at 5 drafts.
- **Gaps/openings:** **per-user pricing** punishes whole-lab adoption (top complaint); **rigid hierarchy** → low actual usage; **AI is shallow/batch (1–24h), not conversational**; self-hosting needs IT grad students lack; no marketplace.

### 2.4 Labguru — *unified ELN+LIMS, enterprise-leaning*
- **What:** unified ELN + LIMS + informatics + inventory ("one system, one code"); industry/pharma/GxP-leaning (95k+ users).
- **Core:** ELN+LIMS in one; inventory/equipment scheduling; **workflow editor**; **datasets + SQL-query dashboards**; chemistry module; eBR; 21 CFR Part 11 continuous validation; API; mobile. **AI:** Assistant, **Protocol Converter**, **Supply Forecast**, **Smart Scheduling**, AlphaFold integration.
- **Borrow:** **Protocol Converter** (unstructured text → structured protocol; same messy-input→structure pattern) · **predictive/agentic *operational* features** (Supply Forecast, Smart Scheduling — a copilot that *anticipates* reagents/instrument time/compute is stickier than a passive notebook) · **NL→SQL→charts over your own data** · genuinely unified data model is what *makes* forecasting/AI possible.
- **Pricing:** **no public pricing**, custom quotes; no advertised free tier.
- **Gaps/openings:** **feature-overwhelm**, steep for individuals; editing-UX friction; **AI is bolt-on, not core**; no free academic path, no marketplace; built for top-down purchase, not bottom-up adoption.

### 2.5 LabArchives — *the academic/education incumbent*
- **What:** widely-adopted **academic/education ELN** (popular for university site licenses + teaching labs). Acquired by **Dotmatics → Siemens (2025)**.
- **Core:** notebook + file capture; **SnapGene & GraphPad Prism integrations**; modular Inventory + Scheduler; **ELN for Education** (course management); compliance + SSO + API. Future AI via Dotmatics **Luma Agent** (May 2026) — "AI co-scientist on structured, ontology-backed point-of-work data" (platform/enterprise, *not* the base academic ELN).
- **Borrow:** **the education/teaching-lab funnel** (capture students during coursework — own the researcher before they have a lab; target comp-bio courses/bootcamps) · **generous transparent free academic tier + self-serve onboarding** (why it spreads on campus) · "structured-at-point-of-work → trustworthy AI" thesis · **modular pay-as-you-grow** (mirrors our copilot-first/notebook-later expansion).
- **Pricing (most academic-friendly):** Free (2 notebooks, 1GB) · Professional **Academic $330/user/yr** · +Inventory/Scheduler modular · **Education $25/student/term** · Enterprise custom.
- **Gaps/openings:** **dated/unintuitive UI**, limited customization, weak integrations, can't-paste-from-Word, auto-logout; **post-acquisition fragmentation** (drifting toward Siemens/enterprise); **base ELN is not AI-native** — the real AI lives in expensive enterprise (the academic majority gets a plain dated notebook). No marketplace, doesn't record computational process.

---

## Category 3 — Verification / open science

*OSF (Center for Open Science) · ResearchHub*

### 3.1 OSF / Center for Open Science — *the methodology, not the marketplace*
- **What:** free, open-source research-management + registry platform run by COS (non-profit; grant/philanthropy-funded, incl. DARPA). Not crypto, not a marketplace.
- **Core:** **preregistration + registered reports** (time-stamped, locked plans); OSF Registries; data/code/preprint hosting + version control; ran the **Reproducibility Project: Psychology** and **DARPA SCORE**. **No payments, no bounties, no token** — incentives are purely reputational (badges).
- **Borrow (highest-value in this whole doc):** **SCORE's three-axis schema** — *reproducibility / robustness / replication* over 3,900 papers, emitting a **per-claim quantitative confidence score** → adopt as our verified-outcome spec (validated, Nature-published) · **confidence scores as the sellable unit** · **prediction markets / structured human forecasting as a cheap pre-filter** (SCORE forecasts hit **76–78%** at predicting replication, far cheaper than replicating) · **preregistration as the anchor** every verification job requires.
- **Incentive model:** none monetary — the exact gap. COS has the methodology + data but no on-demand paid engine to generate it continuously.
- **Gaps/openings:** **replication is project-based + grant-funded, not on-demand** (SCORE ran 2019→~2026; you can't pay to verify a finding tomorrow) — **the core greenfield**; social/behavioral-science-centric (little wet-lab/cross-lab); **no "verified data for sale" product** (their LLM-benchmark work *explicitly isn't selling data to AI labs*). Design input: only **49%** of studies replicated, but reproducibility jumped **38%→91%** when raw data+code were shared → **mandating data+code is the biggest lever on verification cost/success.**

### 3.2 ResearchHub — *the paid marketplace, wrong currency*
- **What:** "Reddit-for-papers" + crypto incentive layer, co-founded by Brian Armstrong (Coinbase). Powered by **ResearchCoin (RSC)**; governed via a DeSci DAO. ~100k+ users, $1.5–1.9M+ distributed.
- **Core:** **paid peer review** ($150 RSC/approved review, **self-selected** from an "Earn tab", ORCID+ID gated, editorial QC, ~10-day payout); **bounty marketplace** (review, replication, data, meta-analysis); ResearchHub Journal (Publish-Review-Curate, ~21-day, $1,000 APC); funding via preregistration; **reproducibility multiplier — 2× if preregistered, 3× if open data**; RSC reputation/governance.
- **Borrow:** **open self-select review marketplace** ("Earn tab" of claimable jobs filtered by domain) — exactly our verifier-claims-a-job primitive · **the reproducibility multiplier is the standout mechanic** (2× prereg / 3× open data engineers the inputs that make *our* verification cheap) · **structured review rubrics** (force a machine-parseable verified-outcome schema, not 3,000-word prose) · **identity gating (ORCID+ID) before paid work** (anti-sybil) · **fixed per-task price** removes negotiation friction.
- **Incentive model — worked/failed:** *Worked* — real money reached real reviewers (some earn more than from salary); proves scientists will do paid verification. *Failed* — **RSC collapsed ~94%** from its $1.59 ATH to ~$0.07–0.13; a token-denominated "$150" is unreliable and invites low-effort gaming (hence caps + QC gates); **crypto on/off-ramp friction** excludes mainstream academics.
- **Gaps/openings:** **token volatility undermines the incentive** → **pay fiat/fiat-pegged**; crypto friction caps scale; **almost no actual replication** — the live product is prose peer-review of preprints, **not cross-lab experiments** (the hardest, most valuable thing is unbuilt); **no structured machine-usable verified-outcome data**; no AI-lab data product.

---

## What this means for our docs (action items)

1. **Strategy §3 (wedge tool):** make the **"copilot session → auto-generated structured ELN entry"** an explicit, designed-in feature — the convergent pattern incumbents charge for, unbuilt for comp-bio. Add **finest-grain provenance** (claim/param/code → source) as a day-one requirement.
2. **Strategy §6 (product):** **stand on the Semantic Scholar Academic Graph API** as the literature backbone. Borrow extraction-tables + a consensus/replication **Meter** + stance classification (replicated/failed/extended) as comp-bio primitives. Note Benchling's MCP move as validation of our architecture.
3. **Strategy §8 + §7 (verification/QC):** **adopt SCORE's reproducibility/robustness/replication schema + per-claim confidence score** as the verified-outcome spec. Use **cheap human forecasting as a pre-filter** before expensive replication. **Mandate + reward data/code** (openness multiplier) — it's the biggest cost lever.
4. **Strategy §11 (pricing):** explicit decision — **pay verifiers/experts in fiat, never a token** (ResearchHub's 94% lesson). Keep the **openness bonus multiplier**.
5. **Strategy §4 + §16 (GTM/funnel):** steal LabArchives' **education/teaching-lab funnel** — capture comp-bio students during coursework, before they have a lab.
6. **Update [Competitive Landscape](./competitive-landscape.md):** add the **SciSpace BioMed Agent** and **Benchling AI + MCP / Dotmatics Luma** as incumbents now moving toward the loop — "no one owns the loop" holds, but the race for AI-native + MCP is on; **speed and genuine execution/verification are the wedge.**
