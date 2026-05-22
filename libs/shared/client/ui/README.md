# client-ui

Shared client-only UI primitives (shadcn-style). Consumed by every Next app
in this workspace via the `@labda/ui` path alias.

## Import paths

```tsx
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { Label } from '@labda/ui/components/ui/label';
import { cn } from '@labda/ui/lib/utils';
```

The aliases mirror the workspace's `components.json` so `pnpm dlx shadcn add <component>`
drops new files into `src/components/ui/` here automatically.

## Adding new shadcn components

From the workspace root:

```bash
pnpm dlx shadcn@latest add dialog dropdown-menu sonner
```

The CLI reads `components.json`, writes new components under
`libs/shared/client/ui/src/components/ui/`, and any new dependencies into the
workspace `package.json`.

## Nx boundary tags

`scope:ui, type:domain, target:client` (ADR-0015). Any `scope:ui` or
`scope:shared` consumer can import; backend `scope:api` libs cannot.
