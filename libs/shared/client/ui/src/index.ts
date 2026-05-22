// Shared client-only UI. Imported by Next apps via path alias:
//
//   import { Button } from '@labda/ui/components/ui/button';
//   import { cn } from '@labda/ui/lib/utils';
//
// The aliases mirror shadcn's `components.json` so `pnpm dlx shadcn add ...`
// drops new files into the right place. Server-only exports (if any) live in
// `./server.ts` (the `@labda/ui/server` alias) to keep them out of the
// client bundle.

export * from './lib/utils';
export * from './components/ui/button';
export * from './components/ui/input';
export * from './components/ui/label';
