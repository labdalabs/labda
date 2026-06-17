# Instrument & Data-Source Integrations

> **Companion to** [Vision & Strategy](./vision-and-strategy.md), [Product Direction](./product-direction.md), and [Field Expansion Map](./field-expansion-map.md).
> **Purpose:** the real tools a bench/comp-bio researcher juggles day-to-day (grounded in Valeria's wet-lab feedback), where we plug in, and the thesis that ties them together.
> **Last updated:** 2026-06-17

---

## 0. The core insight — kill the tool-hopping

The single loudest signal from the first wet-lab feedback: **researchers constantly jump between disconnected tools.** Image on one instrument → measure in its bundled software → paste into Excel → re-type a formula → rebuild a graph in GraphPad → repeat a dozen times per study.

> *"If we handled just the data collection from each of these sources and had everything in one place, that alone would be heroin."* — Paweł

So the win is not any single clever feature — it's **one workspace that ingests from every source and lets the work compound.** This operates at two scales:

- **Micro (within a single experiment):** even while running one experiment, a researcher juggles several tools — one to acquire an image, one to visualize selected images, then export to Excel for anyone to use. Lots to automate here already.
- **Macro (across the lifecycle):** the handoffs *between* stages (acquire → analyze → interpret → write up) are where the bigger, unowned value sits.

The artifact philosophy (from [Product Direction](./product-direction.md) §8): every stage should leave an artifact that feeds the next — embeddings of papers, hypotheses, and protocols that cross-reference each other — so each step builds on the last like a snowball, instead of six tools that *could* have been separate.

---

## 1. The tool landscape (from Valeria's day-to-day)

Each row is a real tool she used, with our angle. We meet users **where they already are** rather than forcing migration.

| Tool | What it is | How we meet it | OSS hook | Effort / note |
|---|---|---|---|---|
| **GraphPad Prism** | A "better Excel" for scientific/medical/biological data viz — strong charts, weak/dated UX | Generate the same charts from open libs, then **enrich/style the UI**; identify the most-used graph types and pre-build templates / one-click integrations | `matplotlib`, `seaborn`, SciencePlots | **Low-hanging fruit, AI-amplified** (Christian). Clunky UX is exactly what we improve. |
| **Bio-Rad** imagers/readers | A class of machines that process samples (cells, bacteria) and capture images/measurements | Ingest images + metadata directly into the workspace; do downstream analysis | Python lib exports the native reader format → TIFF | Integration is feasible and not large; data-collection phase. |
| **Image Lab** (Bio-Rad) | Bundled software to view/tag/measure those images | Process the exported data ourselves; depth depends on their public protocol | Export path confirmed to exist | We don't need deep coupling to be useful. |
| **qPCR machines** | Quantitative PCR — e.g. for sequencing/quantifying DNA | Plug in at the data-acquisition moment; data flows straight into our tool for analysis | Open-source project documenting the data format + processing; an open standard exists | Decide whether we touch the run itself or only ingest results. |
| **Microscopes (Leica LAS X)** | A specific microscope class for imaging cells/tissue | **Tiered ambition** (below) | Python libs to (a) *drive* the scope, (b) read native `.lif` files, (c) post-process acquired images | Most common Python use case is (c). |
| **Excel** | The universal fallback everyone already uses | **Support it natively** — import *and* export — so a teammate can keep working in Excel without onboarding the whole team at once | — | Meet them where they are (the Claude/ELN pattern). |

### Microscope ambition, tiered
1. **Drive the instrument** — with our app on the same network as the scope, Python libs can move the stage, set focus/depth/zoom, and trigger captures. Most exciting; also the most unknown — probably *too much* for v0.
2. **Ingest native files** — pull raw `.lif` images + metadata and process them. Safe, high-value.
3. **End-of-flow analysis only** — assume existing software produced the images; we just do the final analysis over hundreds/thousands of images (or their metadata). This is the **most common real Python workflow** and the laziest, most reliable entry point.

---

## 2. Integration philosophy

- **Open standards & OSS libs only** (MIT/Apache/etc.) — the same posture as the rest of the [stack](./pdr-002-architecture-and-stack.md). Lets us move fast and stay license-clean.
- **No hardware.** We don't build instruments. Things like auto-pipetting or sample heating/cooling are out of scope — we only need to *understand* the process, not automate the bench physically.
- **Ingest-and-analyze is the wedge.** If the tool gets popular, the incentive flips: instrument and consumable vendors (e.g. auto-pipette makers) will want to **build integrations toward us**. Open foundations make that easy.
- **Publish shims as OSS.** When we write a Python connector for a specific instrument and nothing good exists, we open-source it — community goodwill *and* a funnel into the tool (per [PDR-002](./pdr-002-architecture-and-stack.md) §2).

---

## 3. The canvas — a visual workflow over these sources

The integrations come alive in a **node-based, no-code workflow builder** (ComfyUI / n8n-style, engine choice in [PDR-002](./pdr-002-architecture-and-stack.md) §5), purpose-built for bioscience. A typical flow:

```
[Microscope / Bio-Rad image] → [Parser: extract images + metadata]
   → [Group / label datasets] → [YOLO cell-count + viability]
   → [Generate graphs] → [Export to Excel]
```

Double-clicking a block opens the code that backs it. The canvas also doubles as a **whiteboard** for notes and collaborative reasoning, with versioning for multiplayer. It sits alongside the protocol notebook — one side is the structured experiment record, the other a builder that wires the tools together.

> **Open design question:** how to move fluidly between the **notebook** view and the **canvas/workflow** view — they should feel like two lenses on the same work, not two apps.

---

## 4. Vision models — semi-automatic cell counting & viability

The most concrete, immediately useful automation (and Valeria's most-hated chore): **counting and segmenting cells**, plus judging **alive vs. dead**.

- **Approach:** feed a microscope image to a **YOLO / SAM / Cellpose-class** model that counts and segments.
- **Semi-automatic by design:** we don't *guarantee* a perfect count. We auto-mark the clear/obvious cells, and **flag the uncertain or skipped ones (e.g. a different colour) for quick human verification.** This matches the verification ethos — augment and let the expert confirm, "done right, not stupidly fast."
- **Why it's a flagship L0→L3 hook:** clear ground truth, crowd-verifiable, high-volume drudgery; "roughly half an hour with an LLM to get a first version working." Ties directly to [Field Expansion Map](./field-expansion-map.md) §1 (microscopy) and §2 (spatial).

---

## 5. First focus (confirmed this meeting)

Until different feedback says otherwise, the first two areas to build for — **and we can do both at once**:

1. **Comp-bio / bioinformatics (step 0):** help with **data analysis and calculations** — the work researchers already script in Python. Lowest-hanging because we plug into a rich existing ecosystem (papers, data, protocols) and can enter fast.
2. **Microscopy / imaging:** **cell counting & segmentation** via vision models (§4).

Bigger, later, more visionary bets (drug discovery / medicinal chemistry — a large, well-funded US market, e.g. the mRNA-vaccine startups) are parked as premium/later, in the order the marketplace tells us is ripe (see [Field Expansion Map](./field-expansion-map.md)).

---

## 6. Open follow-ons

1. **Which instruments first**, and at what depth (drive-the-scope vs. ingest-only vs. analyze-only).
2. **Validate with Valeria** — does an end-to-end slice actually match her real workflow?
3. **Notebook ↔ canvas** interaction model (§3).
4. **Common graph catalogue** — which GraphPad chart types to template first.
