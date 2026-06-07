# Competitive Landscape

> **Companion to** [Vision & Strategy](./vision-and-strategy.md). Internal.
> **Purpose:** know who we're compared to, where they're strong, and where the gap we walk through is.
> **Last updated:** 2026-06-07

The honest framing (per §12 of the strategy doc): **the marketplace mechanics are commoditizing.** No single competitor does the whole stack — *free comp-bio tool → community → research-as-API → verified data → field ML*. They each own one slice. Our risk is not one giant rival; it's being mistaken for any one of these slices and judged on that slice alone.

---

## 1. Expert-data / RLHF labor marketplaces (our most direct threat)

These already pay PhDs and experts to produce AI training data. If we position as "an expert marketplace," we compete here and lose on capital.

| Company | What they do | Strength | Gap we exploit |
|---|---|---|---|
| **Mercor** | Marketplace matching experts (incl. PhDs, doctors, lawyers) to AI labs for training data & evals | Fast-growing, well-funded, direct lab relationships | Pure labor broker — no daily-use tool, no community, no vertical depth; experts are loyal to the paycheck, not the platform |
| **Surge AI** | High-quality human data / RLHF at scale | Premium quality reputation, large contributor base | Horizontal; anonymous-ish crowd; no science community; no provenance-as-product |
| **Scale AI** | Data labeling & RLHF, enterprise/defense scale | Massive ops, enterprise sales | A mile wide, an inch deep; commodity labeling brand; weak in deep-science expertise |
| **Invisible Tech / others** | Ops-heavy human-in-the-loop data | Operational muscle | Generalist; no domain community or tooling |
| **AI labs in-house** | Labs building their own expert networks | Capital, direct need | They'd rather buy verified domain supply than build & vet it; we become the trusted aggregator |

**Takeaway:** we never market as "a better Mercor." Our wedge (free tool + community + vertical depth + verified provenance + augment-not-replace revenue-share) is exactly what these lack — but only if we lead with it.

---

## 2. AI research / literature tools (the L0 copilot space)

Where we acquire the community. Crowded but shallow per-tool; none owns the full comp-bio workflow + monetization loop.

| Tool | What | Strength | Gap |
|---|---|---|---|
| **Elicit** | AI research assistant over papers (systematic review, extraction) | Strong lit-review UX | General science; no marketplace, no community earnings, no comp-bio depth |
| **Consensus** | Search engine extracting findings from papers | Clean "what does research say" UX | Read-only; no workflow, no data loop |
| **Scite** | Citation-context / smart citations | Trust/credibility signal on citations | Narrow feature; not a workflow |
| **Scholarcy / SciSpace (Typeset)** | Summarize/explain papers, Q&A | Broad adoption | Generic; consumer-grade; no domain ML |
| **Zotero / Mendeley** | Reference management (incumbents) | Huge install base, habit | Not AI-native; integration target, not competitor |
| **General LLMs (ChatGPT/Claude/Gemini)** | Everything, badly, for science | Ubiquitous, free-ish | No domain grounding, no provenance, no community, no real ML — exactly the "sycophancy" we're not |

**Takeaway:** the copilot must be *excellent for comp-bio specifically* (single-cell, RNA-seq workflows), not another generic paper-summarizer. Depth + the "stay and earn" loop is the differentiation; the reading assistant alone is table stakes.

---

## 3. Electronic Lab Notebooks (the L0 → ELN growth path)

| Tool | What | Strength | Gap |
|---|---|---|---|
| **Benchling** | Industry-standard ELN/LIMS for biotech | Owns industry; deep, sticky | Expensive, enterprise; academics underserved; not AI-native; not a community |
| **protocols.io** | Protocol sharing & versioning | Strong academic protocol network | Narrow (protocols only); not a copilot; no earnings loop |
| **LabArchives / SciNote / eLabFTW** | Academic/open ELNs | Institutional footholds | Legacy UX; not AI-native; no marketplace |

**Takeaway:** we don't fight Benchling head-on (industry). We grow an AI-native ELN *underneath the copilot* for academics — a segment Benchling underserves and protocols.io only half-covers.

---

## 4. Research/freelance & "expert-on-demand" marketplaces

| Player | What | Strength | Gap |
|---|---|---|---|
| **Amazon Mechanical Turk** | Generic microtask crowd | Scale, infra | Low-skill, low-trust, low-pay — the *anti-pattern* we define ourselves against ("done right, not stupidly fast") |
| **Kolabtree / Cactus / Science Exchange** | Freelance scientists / outsourced experiments | Real scientist supply; Science Exchange does wet-lab brokering | Bespoke, slow, no API/MCP, no data product, no community/tool |
| **Upwork/Fiverr (science gigs)** | General freelance | Liquidity | No vetting, no science trust, no data loop |
| **Topcoder/Kaggle (adjacent)** | Competition-based data science | Engaged community | Competition model, not commissioned research; no bio depth |

**Takeaway:** Science Exchange is the closest on *wet-lab brokering* (relevant to our parked premium tier), but none expose **research-as-an-async-API (MCP)** with provenance and a data-licensing line. That combination is open.

---

## 5. Reproducibility / verification (the L1.x network)

| Player | What | Strength | Gap |
|---|---|---|---|
| **Center for Open Science / OSF** | Open-science infra, preregistration, replication initiatives | Credibility, academic trust | Non-profit infra, not a paid on-demand verification marketplace |
| **ResearchHub** | Tokenized open science / paid peer review | Pays for review; community ethos | Crypto-flavored; broad; not a verified cross-lab replication service with a data product |
| **Journals' peer review** | Incumbent verification | Authority | Slow, unpaid, opaque, not on-demand, not reproducible-by-design |

**Takeaway:** **on-demand, paid, cross-lab replication with structured verified-outcome data is largely greenfield.** This is one of our most defensible and most on-mission slices.

---

## 6. Field-specific ML tools (the L3 destination)

These validate that L3 is real and valuable — and that point tools exist but no one feeds them from a research community + marketplace flywheel.

| Tool / area | What |
|---|---|
| **AlphaFold / ESMFold** | Protein structure prediction (the proof that field ML transforms a subfield) |
| **Cellpose / StarDist / CellProfiler** | Microscopy cell segmentation (our "genome/cell segmentation" hook) |
| **scanpy / Seurat / Bioconductor** | Single-cell & genomics analysis (incumbent open-source — integration & augmentation targets, not enemies) |
| **YOLO / SAM (Segment Anything)** | General vision backbones we'd specialize for bio imaging/spatial labeling |
| **DeepLabCut** | Animal pose estimation (community-driven bio-ML success story to emulate) |

**Takeaway:** L3 tools exist as isolated point solutions. Our edge is the **flywheel that tells us which bottleneck to automate next and supplies the verified training data to do it** — and the community that adopts the result. We build ML *informed by watching thousands of real workflows*, which a standalone tool team can't.

---

## 7. Where the gap is (one paragraph)

Everyone owns a slice; **no one owns the loop.** Mercor/Surge have demand but no tool or community. Elicit/Consensus have a tool but no marketplace or data product. Benchling has the notebook but only for industry and not AI-native. Science Exchange brokers experiments but with no API/community/data line. COS/ResearchHub touch verification but not as a paid, productized, data-generating service. **Our defensibility is being the only one that connects free comp-bio tool → loyal community → research-as-API → verified data → field ML, with augment-not-replace revenue-share binding the community to us through the automation transition.** The sequencing is the moat (§12).
