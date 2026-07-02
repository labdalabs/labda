# @labda/desktop

macOS desktop app for labda — a thin [Electron](https://www.electronjs.org/) shell around the Next.js UI in `apps/ui`.

The shell loads the UI over HTTP (it does not bundle it), so the desktop app always shows the same app as the browser:

- **Packaged app:** defaults to the production UI at `https://labda.app`
- **Dev (`electron .` / `nx serve desktop`):** defaults to `http://localhost:4200` (`pnpm nx dev ui`)
- `LABDA_APP_URL` overrides either default

## Develop

```bash
# terminal 1 — run the web UI (and the API, if you need it)
pnpm nx dev ui

# terminal 2 — launch the desktop shell
pnpm nx serve desktop
```

If the UI isn't up yet the window retries automatically until it is.

## Package for macOS

```bash
pnpm nx run desktop:package        # .dmg + .zip for arm64 + x64 in apps/desktop/release/
```

Builds are unsigned by default. To sign/notarize, provide the usual `CSC_*` / `APPLE_*` env vars electron-builder expects.

### Installing an unsigned build

Until builds are notarized with an Apple Developer ID, macOS Gatekeeper will refuse the downloaded app with "Labda is damaged / cannot be opened". Recipients have two options after dragging `Labda.app` to Applications:

- Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** after the first blocked launch, or
- clear the quarantine flag: `xattr -dr com.apple.quarantine /Applications/Labda.app`

## Notes

- External links (different origin than `LABDA_APP_URL`) open in the default browser; in-app navigation stays in the window.
- The preload script exposes a tiny read-only `window.labdaDesktop` object so the UI can detect it's running inside the shell.
- Security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
