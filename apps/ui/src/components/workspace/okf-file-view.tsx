'use client';

import type { WorkspaceTab } from '@/lib/workspace/store';

// A read-only view of one OKF markdown file, opened from the file explorer.
// The content is the node's markdown body (authored nodes carry their own; a
// derived entity shows its synthesized summary).
export function OkfFileView({ tab }: { tab: WorkspaceTab }) {
  return (
    <section
      className="mx-auto max-w-3xl space-y-4 p-8"
      data-testid="okf-file"
    >
      <header className="space-y-1 border-b pb-3">
        <p className="font-mono text-xs text-muted-foreground">{tab.filePath}</p>
        <h1 className="font-heading text-xl font-semibold">{tab.title}</h1>
        {tab.nodeType && (
          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {tab.nodeType}
          </span>
        )}
      </header>
      {tab.content ? (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
          {tab.content}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">
          This file has no written content yet.
        </p>
      )}
    </section>
  );
}
