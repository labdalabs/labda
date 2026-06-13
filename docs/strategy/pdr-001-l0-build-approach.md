# PDR-001 — L0 Build Approach: VS Code Plugin, Not a Fork

> **Status:** Decided. Supersedes the "fork VS Code" decision in [Product Direction §3](./product-direction.md) for the v0/L0 phase.
> **Companion docs:** [Vision & Strategy](./vision-and-strategy.md) (§3 wedge tool, §14 sequencing) · [Product Direction](./product-direction.md) · [Competitor Teardown](./competitor-teardown.md)
> **Last updated:** 2026-06-13
> **Owner:** CTO

---

## 1. Decision

**v0/L0 ships as a VS Code extension (plugin), not a forked Code-OSS IDE.**

The original strategy (Product Direction §3) committed to the Cursor playbook — fork Code-OSS, customize the shell, build the copilot in. After grilling the assumptions, we are **deferring the fork indefinitely** ("later, if ever") and shipping the entire L0 surface as a plugin on stock VS Code.

The throughline: **v0 is a beautifully-paneled VS Code extension, not a forked IDE.** This collapses our single biggest execution risk (fork surface area for a 3-person team), frees the entire 6-month v0 clock for the copilot and protocol primitive that actually compound into the moat, and preserves zero-friction adoption — including the remote-SSH cluster workflow comp biologists already live in.

---

## 2. Context — why this was reopened

Product Direction §3 reads "decided: fork VS Code." It was reopened by a concrete doubt: **would a fork slow us down if we later wanted a fundamentally different UI?** Three alternatives were on the table — fork VS Code, fork Firefox (browser-as-ecosystem), or a fresh Electron app — plus the underlying question of whether agent-assisted coding makes "from scratch" viable now.

The grilling resolved each. The decisive realization: **the only thing that forces a full Code-OSS fork is a completely reinvented shell** (title bar, activity bar, tab strip, window chrome). Everything that is actually our differentiation — copilot, protocol editor, canvas, science panels, the whole loop — lives happily in a plugin. So a fork means taking on our heaviest risk *solely* to restyle the chrome. Not worth it for v0.

---

## 3. Decisions log (the grilling, resolved)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Does a fresh/canvas UI need to escape VS Code's layout? | **No.** Notebooks are the non-negotiable core; the canvas is an **additive panel** (overview now, possibly an n8n-style no-code workflow builder later), not a layout replacement. | A canvas panel is just a webview. VS Code only fights us if the canvas *replaces* the editor — it doesn't. |
| 2 | Fork Firefox / browser-as-ecosystem? | **Off the table.** | Was driven entirely by the UI-flexibility fear that Q1 resolved. |
| 3 | Fresh Electron app with Monaco? | **No — VS Code is the base.** Monaco noted as a fallback only. | A fresh app means rebuilding LSP wiring, Jupyter kernels, terminal, debugging, git, extensions — all of which VS Code gives us for free and none of which is our differentiation. |
| 4 | How Jupyter-native must v0 be? | Full notebook support (render + live kernel execution + variable inspector). **Custom science cell types deferred.** Build a **custom protocol format** instead. | Scientists are fine writing a hypothesis in a markdown cell today; don't solve an unvalidated problem. The protocol format is where the novel value is (see §4). |
| 5 | Team capability? | CTO owns the shell. Strong TypeScript (10+ yrs); VS Code internals are learnable; agents do the heavy lifting. | TypeScript is the transferable skill, and the plugin path needs far less VS Code internals depth than a fork. |
| 6 | How beautiful? | Beauty budget goes to the **webview panels** (protocol editor, copilot, canvas, science sidebar) — Linear-grade. **Shell stays VS-Code-shaped.** | A plugin can't touch VS Code chrome. The honest trade: "the science panels are gorgeous and the loop is magic," not "the whole app looks nothing like VS Code." |
| 7 | v0 = fork or plugin? | **Plugin.** Distributed so it *feels* like a product (see §6). | v0's job (per strategy §14) is community + proving the paid-research loop — not a polished shell. Investors at pre-seed fund traction and insight, not chrome. |
| 8 | Biggest fork fear? | Surface area / maintenance burden for a small team → resolved by **plugin-forever**. | The fork's "heaviness" is mostly the upstream-merge burden. Plugin removes it entirely. |
| 9 | OS coverage? | **Windows (primary assumption), macOS, Linux** — all free via the plugin. **Remote-SSH is a v0 must-have.** | Bioinformatics lives on remote Linux HPC clusters; scientists must keep that workflow with zero friction. |
| 10 | Distribution? | **v0:** Marketplace/Open VSX listing **+** a branded VS Code Profile. **v1 (post-raise):** real branded installer with auto-update. | The Profile delivers ~80% of the "branded product" feel for ~0% of installer/signing/notarization plumbing. |

---

## 4. The protocol primitive (most load-bearing outcome)

The single most important thing surfaced in this discussion: **the protocol is not just a file format — it is the central data primitive of the entire platform.** Every layer depends on it.

- **Format:** a notebook-like document that is a **hybrid of natural-language steps and executable code cells** (Q4 "B"), with **lightly formal structured elements** borrowed from a more rigorous schema (materials, equipment, expected outcomes, decision branches — "C"). It is our **own custom view/file format**, distinct from `.ipynb`, but it **may compile to / interoperate with a notebook**.
- **Why it's the foundation:**
  - **Marketplace (L1):** a task ships and returns *as* a protocol execution — easy to understand, easy to follow, reviewable.
  - **Verification (L1.x):** a verification job *is* a protocol re-run in a different environment/lab.
  - **Data moat (L1.5):** structured protocols + their runs are exactly the clean, consented, schema'd reasoning + results AI labs want.
  - **Simulation / L3:** the structured steps let us **forecast/simulate** — first for computational biology, later RL environments that simulate bacteria, cell growth, even vision data for microbiology.
  - **AI gap-detection:** because steps are structured, the copilot can find **gaps in protocol instructions** (missing temperature, no fallback branch if viability drops, etc.) — a differentiator protocols.io lacks and Benchling only does superficially.
- **Implication:** get the protocol schema right and every layer has a foundation; get it wrong and we refactor across all of them. This deserves dedicated design before code.

---

## 5. The beauty trade (explicit)

We cannot have both a "B-level beautiful, Linear-reinvented-Jira shell" **and** "plugin forever." The plugin path means:

- **The shell stays recognizably VS Code** — themed, tidied, branded, but a VS Code user will know what it is.
- **The entire beauty budget goes to the webview panels we fully control** — protocol editor, copilot, canvas, science sidebar. These hit Linear-grade polish.

This is a coherent, defensible position (it's what every strong VS Code extension does), but it is a real step back from full visual reinvention. **Accepted for v0.** If the beautiful shell ever becomes a genuine competitive necessity — not a founder itch — the fork question reopens (see §7).

---

## 6. Distribution plan

**v0 (now):**
- **Open VSX + VS Code Marketplace listing** — for the "I already live in VS Code, just give me the extension" crowd (the daily-use community hook).
- **Branded VS Code Profile** — bundles our extension + theme + settings + recommended companion extensions into a single shareable link/file. Makes stock VS Code look and feel like Labda on first open. Near-zero distribution plumbing; demos great to investors and design-partner labs.

**v1 (post-raise):**
- **Real branded installer** with auto-update across Windows/macOS/Linux, once there's a dedicated person to own signing, notarization, and the update pipeline.

We avoid building installer/signing/notarization/auto-update plumbing during the phase where the only thing that matters is community + the proven loop.

---

## 7. When the fork question reopens (deferred triggers)

Forking is "later, if ever." The honest triggers that would justify revisiting it:

1. The **beautiful/distinct shell becomes a measurable competitive wedge** (not an aesthetic preference) — e.g., we lose users or deals specifically because we're "just a VS Code extension."
2. We hit a **plugin API ceiling** that blocks a core experience we've validated users need.
3. We have the **team and money** (post-raise, a dedicated owner) to take on a fork **with the minimal-core-diff discipline** — theme + chrome + thin workbench overrides only, nothing deep, to keep the upstream-merge burden survivable (the Cursor/VSCodium pattern).

Until then: plugin, and push the branded-Profile/installer distribution as far as it will carry us — possibly well beyond v1.

---

## 8. Constraints this imposes on the build (for the PDR → engineering hand-off)

- **Workspace-extension correctness:** the extension must work in VS Code's **remote-SSH** model — activating on the remote host and capturing runs *there*, not just as a local UI extension. This rules out local-only shortcuts and interacts with the deferred **compute-model decision** (local vs hosted vs remote-user kernels — Product Direction §10.2). Carry remote-SSH capture into that decision.
- **Open tooling only:** ship open Jupyter/Python tooling via Open VSX — **not** Microsoft's proprietary Pylance/packaging (the same Open-VSX + open-language-server path Cursor used). Flagged for the licensing review already noted in Product Direction §10.3.
- **Beauty in webviews:** the protocol editor, copilot, canvas, and science sidebar are custom webviews — that's where polish and design effort concentrate.
- **Protocol format design precedes protocol code** (see §4).

---

# Part II — v0 Plugin Scope

> What actually goes *in* the plugin. Resolved in the same grilling session as Part I.

## 9. The copilot is lifecycle tooling, not a chat box

The headline reframe: **the moat is owning the scientific-method cycle, not the chat.** v0 does not lead with a chat panel — it ships *tooling that supports stages of the research lifecycle* (Product Direction §8). Chat may exist underneath as a surface the tools route into, but it is not the headline and not the value.

This collides with Strategy §14's "narrow and excellent," so v0 takes a **single wedge stage first** and expands. Grab convenient low-hanging fruit to hook users, then deepen.

### v0 build order (within the lifecycle)
1. **Thin `Project → Hypothesis/Topic` object** — the container. (Required first because the literature hook attaches to it; see §13.)
2. **Literature search welded to the hypothesis** — *the hook.* Not standalone lit search (that space is crowded — Elicit, Consensus, Scite, "just ask an LLM"). The value is "find papers → drop them straight into the hypothesis/protocol you're building, with provenance, all in one place." One-stop research software; the connection to the work is the moat, not the search.
3. **Protocol editor** — `.ipynb`-backed, with naive logic-gap detection and free Python execution (see §12).
4. **Analyze output** — hardest, explicitly last.
5. *(later)* paper organizing/grouping, per-thesis knowledge base, auto pros/cons.

## 10. The antagonistic copilot (a first-class product stance)

**The copilot does not flatter — it grills.** Every other AI research tool is a sycophant that agrees with you; ours challenges the idea, surfaces what contradicts you, and pokes holes. This is Vision §0 ("not LLM sycophancy… real ML that elevates scientists") made concrete in the interaction model.

**Critical guardrail — always evidence-grounded, never contrarian-for-its-own-sake.** Every push-back must link to a paper (exact source sentence), a logic gap, or a missing control.
- **Good:** "This contradicts Smith et al. 2023 [link] — your hypothesis assumes X, but they found not-X under these conditions."
- **Bad:** "Have you considered you might be wrong?" (vibes-based; gets disabled in a day.)

This ties the stance directly to the finest-grain-provenance theme (Product Direction §4): *the agent can only challenge you with receipts.*

## 11. Gap-detection as a cross-cutting capability

Not a per-stage feature — one muscle reused across the lifecycle:
- **Literature/hypothesis stage** → **bias/gap finder** (in MVP): surfaces contradicting evidence (Scite-style supports/contradicts), logic gaps in the thesis, and knowledge gaps (what's unstudied). The naive version (supports/contradicts split) ships in v0; deeper reasoning about a specific hypothesis is a fast-follow.
- **Protocol stage** → logic-gap detection (missing steps, unhandled branches).
- **Analyze stage** → (later) sanity-checks on results vs. hypothesis.

## 12. Protocol editor — v0 cut

The central data primitive (§4), so the v0 line is deliberate:
- **Structured authoring:** NL steps + code cells + light formal fields (materials / inputs / expected-outcome).
- **Built on top of `.ipynb`:** "export to Jupyter" is trivial because it *is* Jupyter underneath. De-risks the "right schema" problem — graduate to a custom format later.
- **Standard Python execution is free:** inherited from the Jupyter foundation (standard kernel, same as any notebook) — *in* at zero extra cost.
- **Naive logic-gap detection** (shares the §11 gap muscle).
- **Deferred:** custom execute blocks, simulations, custom file format.

## 13. Object model — v0 cut

Minimum hierarchy that everything above requires (full spine in Product Direction §8):
- **`Project`** — the research-initiative container.
- **`Hypothesis/Topic`** — what literature + the bias finder attach to.
- **`Protocol`** — the `.ipynb`-backed experiment doc.
- **`Reference`** — attached literature with provenance.

**v0 is single-user, local-first with sync.** **Deferred:** `Lab` and multiplayer (later via Supabase presence/realtime, ADR-0021), `Preregistration`, `Dataset`-as-object, `Finding`, `Report/Preprint`, and the forking/sharing graph.

## 14. Backend, accounts & AI-cost control

**Accounts exist day one, but the wall sits in front of the *AI features*, not the *app*.** (The Cursor model.)
- **Zero-friction install** — extension installs, panels open, look around freely; no signup wall.
- **Auth at first AI use** — lightweight OTP/OAuth (Supabase auth, ADR-0013/0020), ideally *after* a taste of value.
- **Why auth is mandatory:** *we* pay for LLM inference, and Strategy §16 budgets only ~$10k for all of phase-0 LLM/infra. Open access = uncapped cost + abuse (free Claude proxy). So **per-account rate limits** are the real cost lever.
- **BYOK escape valve** — power users can plug their own Anthropic/OpenAI key to bypass limits, but **hosted-free inference is the magnet** for a broke academic audience and stays the default.
- This reinforces capture (§15): since AI use requires auth, free-tier reasoning data reaches the backend from day one.

## 15. Process-data capture model (the moat)

Three tiers, designed around consent (Strategy §5/§10):
- **Free tier:** copilot interactions collected **by default with full opt-out**, transparently disclosed — used for **platform improvement / L3 training only**.
- **Paid / marketplace (opt-in):** **everything** captured — consented work-for-hire (especially for the founder-funded first assignments).
- **Enterprise / labs (future):** **zero** collection — "we don't touch your data" is a *sellable feature*.

**Resale to AI labs only ever on the explicit-consent path** — never free-tier-by-default. GDPR treats *collect* and *sell* differently: opt-out telemetry for platform improvement is defensible, but third-party resale of personal/IP-laden reasoning needs explicit affirmative consent. This keeps the public promise literally true: **"we sell commissioned work-for-hire, never surveillance"** (the §12 ethics moat). Avoids reopening the surveillance-data minefield §5 was written to sidestep.

## 16. Earn-money opt-in — deferred (deliberate deviation from Strategy §4)

The "opt in to get paid for research tasks" hook is **deferred until the marketplace exists**, rather than baited from day one. Rationale: a toggle that leads nowhere for months is an empty promise that erodes trust more than it helps. **Mitigation for §4's concern:** we still identify the supply pool from *usage* (power users are visible without a toggle) and invite them first when the marketplace is ready. **ORCID login** is added at that point (doubles as credential vetting, Strategy §7).

---

## 17. Open follow-ons (not blocking these decisions)

1. **Protocol schema design** — the hybrid NL + code + light-formal structure; v0-minimal vs. the full vision (deeper gap-detection, simulation hooks). Highest-priority follow-on (§4).
2. **Compute model** — local vs hosted vs remote-user-cluster kernels, explicitly entangled with the remote-SSH must-have (§8) and hosted-inference cost (§14).
3. **Deeper bias/gap finder** — reasoning about a specific hypothesis's logic/knowledge gaps, beyond the naive supports/contradicts split (§11).
4. **Licensing confirmation** — Open VSX + open-language-server path clears Microsoft's proprietary components (§8).
5. **Rate-limit + cost model** — concrete per-account limits that keep phase-0 LLM spend within ~$10k (§14).
