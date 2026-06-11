# Product Direction — the L0 surface: "VS Code for science"

> **Companion to** [Vision & Strategy](./vision-and-strategy.md) (§3 wedge tool) and [Competitor Teardown](./competitor-teardown.md).
> **Status:** Internal product/UX direction. Working name **"Labda Studio"** (placeholder).
> **Last updated:** 2026-06-07

---

## 1. Thesis

**A beautiful, AI-native, Jupyter-native workspace that streamlines computational research — and quietly becomes the ELN and the on-ramp to the marketplace.**

Think **"Cursor / VS Code for science."** We fork VS Code (it's already Jupyter-native and forkable — the exact playbook Cursor used), make it genuinely beautiful and science-focused, build the AI copilot in, and layer the ELN, provenance, sharing, and marketplace on top.

The notebook is the center of gravity. It's simultaneously:
- the **workspace** where comp biologists already do their work,
- the **ELN entry** (auto-structured, versioned, shareable),
- the **process-data record** we sell and train on,
- and the **unit of work** for the marketplace and verification network.

One surface, one data model, the whole loop.

---

## 2. Why this surface (rationale)

- **Zero switching cost = the adoption bet.** Comp biologists already live in VS Code + Jupyter. Our L0 thesis is "they try it tonight" — meeting them in the tool they already use beats any bespoke ELN. (Contrast: Benchling/SciNote/Labguru force a new app; their data models are wet-lab-shaped — sequences/plasmids/samples — not code/dataframes/runs. Comp biologists are **underserved**, per the [teardown](./competitor-teardown.md).)
- **Comp-bio-native data model.** Our "entities" are notebooks, code, params, datasets, and runs — not plasmids. This is the lane no incumbent occupies.
- **The notebook IS the process record → the data moat for free.** Code + params + outputs + narrative, in order, is exactly the structured research-process data we want — captured as a byproduct of how they already work, no separate logging UI. (COS/SCORE proved mandating data+code is the single biggest lever on verification: 38%→91% reproducibility.)
- **It makes the whole loop coherent.** The copilot lives *in* the notebook (augment-in-place, like Benchling Compose / Semantic Reader); the ELN *is* the notebook; marketplace tasks ship *as* runnable notebooks with provenance; an MCP agent submits a task → gets back an executed notebook. Fork/diff/share is git-native for notebooks (the protocols.io pattern).

---

## 3. Build approach — fork VS Code

**Decision: fork VS Code (Code-OSS), the Cursor playbook.** Don't build a notebook from scratch; don't settle for a plain JupyterLab extension.

- **What we get for free:** first-class Jupyter notebook support, a mature/loved editor, the extension model, terminal, git, remote/SSH, debugging, and a UX comp biologists already know.
- **What we add (our value-add layer):** the in-editor AI copilot, finest-grain provenance + versioning capture, Benchling-style context panels, embedded literature/verification widgets, and the fork/share/marketplace hooks.

### Considerations / risks to track
- **Licensing.** Code-OSS is MIT and forkable, **but** Microsoft's official build, the VS Code Marketplace, and key extensions (**Pylance**, the official Python/Jupyter packaging, C++ debugger, etc.) are **proprietary and not licensed for forks.** Cursor handled this by using **Open VSX** + open language servers. We must do the same: ship open Jupyter/Python tooling, not Microsoft's proprietary bits. **Flag for legal review.**
- **Upstream maintenance burden.** Forking means tracking upstream VS Code releases. Real but well-trodden (Cursor, Windsurf, VSCodium, Theia prove it's viable).
- **Compute / kernels.** Decision deferred: user's own local kernel (cheap, but weaker process-data capture and harder for hosted marketplace tasks) vs. hosted kernels (cost + ops, but clean capture + reproducible task execution). Likely **both** — local for personal work, hosted for marketplace/verification runs.
- **Desktop vs web.** VS Code fork is desktop-first (Electron) but has a browser path (code-server / vscode.dev model). Start desktop; keep web in view for zero-install marketplace tasks.

### Alternatives considered (and why not)
- **Plain JupyterLab extension** — less control over polish/UX, harder to deliver the "beautiful, streamlined" experience and the integrated panels.
- **Build our own notebook from scratch** — too costly, and we'd lose the "it's just my familiar editor" zero-friction adoption that is the entire bet.

---

## 4. The UI/UX — "beautiful and streamlined" + Benchling ideas to graft

The differentiation isn't features — it's a *streamlined, beautiful* surface that makes research flow. Concretely, what we borrow and build (sources in the [teardown](./competitor-teardown.md)):

- **In-editor AI copilot (Cursor-style).** Inline cell assistant ("explain/fix/optimize this analysis"), chat with full notebook + data + literature context, and a **"compose my messy session into a clean, structured entry"** action (Benchling *Compose* / SciNote *Manuscript Writer*, done conversationally — the convergent pattern nobody offers comp-bio).
- **Integrated context panels (Benchling-style).** Notebook + a side panel that unifies relevant literature, the dataset/variables in scope, provenance, and tools — in one view, instead of tool-hopping.
- **Results & predictions next to the work** (Benchling puts AlphaFold/Boltz predictions beside the data) — collapse the analyze↔interpret loop into one surface.
- **Finest-grain provenance, surfaced inline** (Elicit's click→exact-source-sentence). Every copilot-suggested param/method/citation links to its source and is verifiable. This is the antidote to the hallucination complaints dogging every AI research tool.
- **Embedded literature/verification widgets:** a **consensus/replication "Meter"** over methodological choices (Consensus), a **supports/contradicts/replicated** signal on methods (Scite stance classification), built on the **Semantic Scholar** free API as the literature backbone (don't rebuild the corpus).
- **Fork / diff / share notebooks** with citable references (protocols.io) — the academic growth loop *and* the marketplace/commons primitive none of the incumbents have.

---

## 5. The ELN grows inside the notebook

No separate ELN app. As the user works in the notebook, the copilot turns the session into a **structured, versioned, shareable entry** (the "messy input → structured entry" pattern). The notebook + its run history + provenance *is* the lab record — AI-native, comp-bio-shaped, and forkable. This is the "notebook-later" half of §3, delivered without ever asking the user to migrate or double-enter.

---

## 6. Process-data capture (the moat)

The workspace silently captures the **session as structured exhaust**: code, params, outputs, re-runs, dead-ends, and copilot interactions — the reasoning *and* the result. Incumbents store final documents; we record the process. This is:
- what we **sell** to AI labs (clean, consented, work-for-hire reasoning + results — §5/§10 of strategy),
- what we **train** L3 field-ML on (§ field-expansion map),
- and the input that makes verification cheap (mandate + reward data/code, per SCORE).

Capture is designed-in, not bolted-on — a first-class feature of the surface.

---

## 7. How it wires into the loop

- **Marketplace / MCP.** A task ships and returns as a **runnable notebook with provenance**. An AI agent calls `submit_research_task(...)` → a vetted scientist does it in the workspace → the agent gets back an executed, reproducible notebook. "Done right, not stupidly fast" = a reproducible notebook, not a chat blob.
- **Verification network.** A verification job = **re-run / replicate a notebook** in a different environment (or a different lab), emitting SCORE-style **reproducibility / robustness / replication** + a per-claim confidence score. The notebook format makes cross-lab replication mechanically possible.
- **L3 field ML.** The captured notebooks are the training corpus for field automations (genome/cell segmentation, spatial auto-labeling); those tools surface as copilot actions *inside* the workspace — augmenting the scientist (§13), not replacing them.

---

## 8. Built on the scientific method — information architecture

**Principle: the whole product is organized around the established scientific method and its real artifacts — and it speaks the scientist's language, not generic SaaS terms.** (Reference: the OSF research lifecycle and OSF project structure.) This is the information architecture, the data model, *and* the copilot's mental model.

### The research lifecycle (the spine)
We structure the product around the canonical loop (OSF's wheel):

**Search & Discover → Develop Idea / Hypothesis → Design Study → Acquire Materials → Collect Data → Store Data → Analyze Data → Interpret Findings → Write Report → Publish (Preprint/Paper)** → *(feeds back into Search & Discover)*.

The copilot is **lifecycle-aware** — it knows which stage you're in and helps accordingly (find papers, sharpen a hypothesis, draft a protocol, run an analysis, interpret a result, write it up). For comp-bio we keep the canonical spine but tune the weight: "Acquire Materials / Collect Data" is mostly **acquiring datasets**, and "Analyze / Interpret" (notebooks, pipelines) is where the center of gravity sits.

### The object model (the hierarchy)
First-class objects, named in scientists' terms (OSF's Lab → Research Initiative → Hypothesis / Data collection / Protocol / Lab notebooks):

```
Lab  (a PI's group, or an individual researcher's space)
 └─ Project / Study  (a research initiative)
     ├─ Hypothesis          the testable claim
     ├─ Preregistration     time-stamped, locked study plan
     ├─ Protocol            the method/procedure (forkable, citable)
     ├─ Dataset             acquired/collected data
     ├─ Notebook            the computational record (Jupyter) = our ELN unit
     ├─ Analysis            the work over data
     ├─ Finding / Result    the interpreted outcome (claim supported/refuted)
     └─ Report → Preprint → Paper   the write-up and its publication
```

**Why this is strategic, not cosmetic:**
- **Trust/credibility** — it reads as "built by people who actually do science," which is the brand (§12 of strategy).
- **A smarter copilot** — reasoning over *Hypothesis/Protocol/Finding* objects beats reasoning over generic "documents." It can check a result against its hypothesis, or a method against its protocol.
- **The object chain IS the process-data moat** — `Finding → Analysis → Notebook → Dataset → Protocol → Hypothesis` is exactly the structured provenance AI labs want and verification needs (trace any claim back through its method and data).
- **Verification maps natively** — a verification job targets a **Finding**, re-runs its **Protocol/Notebook** on its **Dataset**, and emits SCORE-style reproducibility/robustness/replication (§7 of strategy). Preregistration is the anchor (ties to the openness-multiplier finding).

---

## 9. Ubiquitous language

Adopt the field's vocabulary everywhere — UI, copilot, API/MCP, and code. Avoid generic software words when a scientific term exists. (This is the product-level [Ubiquitous Language](../../CONTEXT.md); keep code and UI in sync with it.)

| Use this term | Means | Avoid |
|---|---|---|
| **Lab** | A research group or individual researcher's top-level space | Organization, team, account |
| **Project / Study** | A research initiative; a designed investigation | Workspace, repo |
| **Hypothesis** | The testable claim under investigation | — |
| **Preregistration** | Time-stamped, locked study plan (pre-data) | Spec, plan |
| **Protocol** | The method/procedure; forkable, citable | Recipe, SOP, template |
| **Dataset** | Acquired/collected data | File, upload |
| **Notebook** | The computational record (Jupyter) = ELN unit | Document, page, file |
| **Analysis** | Computational work over a dataset | Job, script run |
| **Finding / Result** | Interpreted outcome; claim supported/refuted | Output |
| **Report → Preprint → Paper** | Write-up → pre-publication → published | Doc, article |
| **Replication / Reproduction** | Verification acts (new data / same data) | Re-check, retest |
| **Provenance** | The chain linking a finding back to its data & method | History, audit log |

Wet-lab terms (Assay, Reagent, Sample) stay parked until the wet-lab tier (§6 of strategy). The MCP task spec and the marketplace use these same nouns — a task is "verify this **Finding**" or "run this **Analysis** on this **Dataset**," not "do this task."

---

## 10. Open considerations / next decisions

1. **MVP scope.** Do we ship the full forked IDE in v0, or a focused slice (copilot + notebook + a few panels) first? Lean toward a **focused slice of the forked surface** — the differentiated workspace is the point, but we don't build every panel/widget before launch. (Ties to strategy §14 sequencing.)
2. **Compute model** — local vs hosted kernels (see §3). Decide alongside marketplace productization.
3. **Licensing review** — confirm the Code-OSS + Open VSX + open-language-server path clears us of Microsoft's proprietary components (see §3).
4. **Naming/branding** — "Labda Studio" is a placeholder.

---

## 11. What we steal / the whitespace (pointers)

The full **features-to-borrow list** and the **confirmed whitespace** (no one connects to paid experts, no one productizes process data, on-demand paid cross-lab verification is unbuilt, structured verified-outcome data is unowned) live in **[Competitor Teardown](./competitor-teardown.md)** — already committed. This doc is where those findings converge into a single product surface: **a beautiful, AI-native, Jupyter-native, forked-VS-Code workspace that streamlines comp-bio research and becomes the ELN, the data moat, and the marketplace on-ramp.**
