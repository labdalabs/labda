# ADR-0024: Notebook compute model — in-browser Pyodide kernel for v0

## Status

Accepted

## Context

Issue #8 requires running a Protocol notebook against a live Python kernel:
execute cells, stream outputs back, inspect variables. The open decision (per
the issue and PDR-001 §8 / PDR-002 §8) is the **compute model** — local kernel
vs hosted kernel — which is entangled with the future remote-SSH must-have.

Forces:

- We want *standard* Python execution (the Jupyter foundation), not a
  reimplementation.
- v0 must run with **zero external infrastructure** — no Python install, no
  kernel gateway, no per-user containers to provision and secure.
- The product ships as a **VS Code webview** (issue #11) and, later, a hosted
  browser build. A kernel that already lives in the browser moves with the
  webview for free.
- Executing arbitrary user Python **server-side** is a security and capacity
  problem (sandboxing, resource limits, multi-tenant isolation) we do not want
  to take on for v0.

## Decision

For v0 the kernel is **Pyodide — CPython compiled to WebAssembly — running in
the browser (the client), not on the server.** This is the *local kernel* path.

- Execution happens in the user's browser/webview via a lazy-loaded Pyodide
  runtime (pinned version, loaded from the jsDelivr CDN).
- Cell outputs (stdout/stderr streams, the last-expression `execute_result`,
  tracebacks as `error`, and matplotlib images as `display_data`) are captured
  as **nbformat-4 output objects** and written back into the notebook cells.
- A **variable inspector** reads the kernel's global namespace after each run
  (name, type, short repr; dunders/modules/functions filtered out).
- Outputs **persist with the notebook**: they live in the cell JSON and are
  saved through the existing authorized `saveProtocol` mutation (owner-scoped —
  ADR-0007/0020). Reopening a Protocol shows the last outputs.

### Authorization

The local kernel runs on the user's own machine, so there is no server-side
compute to authorize for execution itself. Authorization applies where it
matters: **persisting** outputs goes through `saveProtocol` (per-user, owner
-scoped). When a hosted/remote kernel is added, execution *requests* will be
authorized server-side at that boundary.

### Large outputs

For v0, images are inlined as base64 PNG `display_data`. Oversized outputs
(large images, big tables) will be offloaded to Supabase Storage (ADR-0022) as
a fast-follow; the nbformat output objects then carry a reference instead of
the inline blob.

## Consequences

**Accept:**

- Zero backend compute/infrastructure; nothing to sandbox or scale server-side.
- Standard CPython semantics (Pyodide is CPython) with the scientific stack
  (numpy, pandas, matplotlib, …) available on demand via `micropip`/packages.
- The kernel travels with the webview into VS Code (#11) and a future hosted
  browser build unchanged.
- Privacy: user code and data stay on the user's machine.

**Live with:**

- First run downloads the Pyodide runtime (~10 MB WASM) from the CDN; mitigated
  by pinning + browser caching. Offline first-load is not supported in v0.
- WASM Python is not 100% CPython-identical (threading, some C extensions,
  sockets) and is slower than native. Acceptable for authoring/analysis v0.
- Heavy/long-running compute wants a **hosted or remote-SSH kernel** — this is
  the documented fast-follow. The kernel is accessed through a single
  `NotebookKernel` interface in the UI so the in-browser implementation can be
  swapped for a streaming remote kernel (Supabase Broadcast — ADR-0021 — or an
  SSE endpoint) without touching the editor.

## References

- ADR-0007: GraphQL-first API (saveProtocol persists outputs)
- ADR-0020: Auth via Supabase (owner-scoped persistence)
- ADR-0021: Realtime via Supabase Broadcast (future remote-kernel streaming)
- ADR-0022: Storage via Supabase Storage (future large-output offload)
- Issue #7: Protocol as a Jupyter notebook (the notebook object this executes)
