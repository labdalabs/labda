# ADR-0027: Remote Jupyter kernel (hosted path) — extends ADR-0024

## Status

Accepted — the hosted-kernel fast-follow ADR-0024 promised.

## Context

ADR-0024 shipped an in-browser **Pyodide** kernel as the v0 local-kernel path,
behind a `NotebookKernel` interface, and named a hosted/remote kernel as the
fast-follow for full CPython, native C-extensions, long-running compute, and
remote-SSH execution (PDR-001 §8 / PDR-002 §8). Issue #17 is that follow-up.

## Decision

Add a **`JupyterKernel`** implementation of `NotebookKernel` that talks to a
**real Jupyter server** (Jupyter Kernel Gateway or a notebook server) over the
standard **Jupyter REST + WebSocket messaging protocol**:

- `POST /api/kernels` starts a `python3` kernel; the WebSocket
  `/api/kernels/{id}/channels` carries `execute_request`s and the `iopub`
  replies.
- outputs map to nbformat: `stream` → stream, `execute_result`/`display_data`
  → those, `error` → error with the traceback. stdout streams into the cell as
  it arrives (`status: idle` ends the run).
- the variable inspector runs the same globals-introspection snippet and reads
  it back from stdout.

The editor gains a **compute selector** — *Pyodide (in-browser)* vs *Jupyter
(remote server)* with a URL + token — so the researcher picks per Protocol.
Both implement one interface, so the editor is unchanged otherwise. Outputs
still persist with the notebook via `saveProtocol` (owner-scoped).

Verified against a real **Jupyter Kernel Gateway 3.0.1** running CPython
3.13.1: `print(6*7)` → stream `42`, `6*7` → execute_result `42`, and
`1/0` → a `ZeroDivisionError` traceback.

### jupyter-ui (Datalayer)

Evaluated **Datalayer `jupyter-ui`** (React notebook/kernel/output components)
as the editor surface. Decision for now: **keep the custom notebook editor**
(issue #7) and add only the remote *kernel*. Rationale: `jupyter-ui` pulls in
JupyterLab services/lumino and its own kernel-connection stack, which would
replace — not complement — the lightweight editor and the swappable
`NotebookKernel` seam. Revisit if we need JupyterLab-grade rendering (rich
mimetypes, widgets); the `NotebookKernel` interface leaves that door open.

### Authorization / provisioning

The remote kernel is reached with a server URL + token the researcher supplies.
Multi-tenant kernel provisioning and isolation (one kernel per user, resource
limits, remote-SSH targets) is the operational follow-up (#18); v0 connects to
a provided server.

## Consequences

**Accept:** full CPython + the scientific stack, native extensions, long-running
and remote compute; the editor is kernel-agnostic; the local Pyodide path stays
the zero-infra default.

**Live with:** running/securing a Jupyter server is now an operational concern
when the remote path is used (token, CORS/`allow_origin`, network exposure).
Per-user kernel provisioning and isolation are not yet automated.

## References

- ADR-0024 (local Pyodide kernel), issue #7 (notebook editor), #8, #17, #18
