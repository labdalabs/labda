'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { listProjects } from '@/lib/research/queries';
import { listProtocols } from '@/lib/protocol/queries';
import { okfFiles, type OkfFileMeta } from '@/lib/knowledge/queries';
import type { Project } from '@/lib/research/types';
import type { Protocol } from '@/lib/protocol/types';
import { useWorkspace } from '@/lib/workspace/store';
import { ThemeToggle } from './theme-toggle';

// A persistent Linear/IDE-style shell: a left panel that manages the workspace
// (project switcher) and, inside a project, an explorer that opens tabs in the
// main area (the tabbed <Workspace>). Views, notebooks, and OKF files all open
// as tabs rather than navigating.

const PROJECT_RE = /^\/app\/projects\/([^/]+)/;

function Icon({ path, className = '' }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${className}`}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  projects: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  work: 'M4 6h16M4 12h16M4 18h10',
  graph: 'M6 6h.01M18 6h.01M12 18h.01M6 6l6 12M18 6l-6 12',
  notebook: 'M8 3v18M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  doc: 'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v4h4',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  signout: 'M15 12H4m0 0 4-4m-4 4 4 4M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4',
} as const;

function Row({
  icon,
  label,
  active,
  onClick,
  indent,
  testid,
  title,
}: {
  icon?: keyof typeof ICONS;
  label: string;
  active?: boolean;
  onClick: () => void;
  indent?: boolean;
  testid?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      title={title ?? label}
      className={`flex w-full items-center gap-2.5 truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
        indent ? 'pl-8 text-xs' : ''
      } ${
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      {icon && <Icon path={ICONS[icon]} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: keyof typeof ICONS;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      <Icon path={ICONS[icon]} className="h-3.5 w-3.5" />
      <span>{title}</span>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums normal-case text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

export function AppShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const projectId = pathname.match(PROJECT_RE)?.[1] ?? null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [files, setFiles] = useState<OkfFileMeta[]>([]);

  const activeKey = useWorkspace((s) => s.activeKey);
  const openTab = useWorkspace((s) => s.openTab);
  const graphVersion = useWorkspace((s) => s.graphVersion);

  useEffect(() => {
    if (!email) return;
    listProjects().then(setProjects).catch(() => undefined);
  }, [email]);

  useEffect(() => {
    if (!email || !projectId) {
      setProtocols([]);
      setFiles([]);
      return;
    }
    let live = true;
    listProtocols(projectId)
      .then((p) => live && setProtocols(p))
      .catch(() => undefined);
    okfFiles(projectId)
      .then((f) => live && setFiles(f))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [email, projectId, pathname, graphVersion]);

  const activeProject = projects.find((p) => p.id === projectId);

  // OKF bundle files, grouped by directory. Notebooks/protocols get their own
  // section above; dir index pages are noise in the tree.
  const treeFiles = files.filter(
    (f) =>
      f.dir !== 'notebooks' &&
      f.dir !== 'protocols' &&
      !f.path.endsWith('index.md'),
  );
  const byDir = new Map<string, OkfFileMeta[]>();
  for (const f of treeFiles) {
    (byDir.get(f.dir) ?? byDir.set(f.dir, []).get(f.dir)!).push(f);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <Link href="/app" className="flex items-center gap-2 px-4 py-3.5">
          <Image
            src="/labda_logo_xs.png"
            alt="Labda"
            width={640}
            height={640}
            className="h-5 w-auto"
          />
        </Link>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          <Link
            href="/app"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              pathname === '/app'
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Icon path={ICONS.projects} />
            <span className="truncate">Projects</span>
          </Link>

          {projectId && (
            <div className="mt-4 space-y-0.5">
              <div className="truncate px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {activeProject?.title ?? 'Project'}
              </div>

              <Row
                icon="work"
                label="Work"
                active={activeKey === 'work'}
                onClick={() =>
                  openTab({ key: 'work', kind: 'work', title: 'Work', closeable: false })
                }
              />
              <Row
                icon="graph"
                label="Knowledge"
                testid="open-graph"
                active={activeKey === 'knowledge'}
                onClick={() =>
                  openTab({
                    key: 'knowledge',
                    kind: 'knowledge',
                    title: 'Knowledge',
                    closeable: false,
                  })
                }
              />
              <Row
                icon="settings"
                label="Settings"
                active={activeKey === 'settings'}
                onClick={() =>
                  openTab({
                    key: 'settings',
                    kind: 'settings',
                    title: 'Settings',
                    closeable: true,
                  })
                }
              />

              <SectionTitle icon="notebook" title="Notebooks" count={protocols.length} />
              {protocols.length === 0 ? (
                <p className="px-2.5 py-1 text-xs text-muted-foreground">None yet</p>
              ) : (
                protocols.map((p) => (
                  <Row
                    key={p.id}
                    label={p.title}
                    indent
                    active={activeKey === `notebook:${p.id}`}
                    onClick={() =>
                      openTab({
                        key: `notebook:${p.id}`,
                        kind: 'notebook',
                        title: p.title,
                        protocolId: p.id,
                        closeable: true,
                      })
                    }
                  />
                ))
              )}

              <SectionTitle icon="doc" title="Files" count={treeFiles.length} />
              {treeFiles.length === 0 ? (
                <p className="px-2.5 py-1 text-xs text-muted-foreground">
                  Add nodes in the graph
                </p>
              ) : (
                [...byDir.entries()].map(([dir, items]) => (
                  <div key={dir} className="space-y-0.5">
                    <p className="px-2.5 pt-1.5 font-mono text-[10px] text-muted-foreground">
                      {dir}/
                    </p>
                    {items.map((f) => {
                      const key = `file:${f.path}`;
                      return (
                        <Row
                          key={f.path}
                          label={f.title}
                          indent
                          active={activeKey === key}
                          title={f.path}
                          onClick={() =>
                            openTab({
                              key,
                              kind: 'file',
                              title: f.title,
                              filePath: f.path,
                              nodeId: f.nodeId ?? undefined,
                              nodeType: f.dir,
                              editable: f.editable,
                              closeable: true,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {email ? (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-sky/15 text-xs font-medium text-brand-sky">
                {email[0]?.toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {email}
              </span>
              <ThemeToggle />
              <form method="POST" action="/auth/sign-out">
                <button
                  type="submit"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <Icon path={ICONS.signout} />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/sign-in"
                className="flex flex-1 items-center justify-center rounded-md bg-brand-sky px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-sky/90"
              >
                Sign in
              </Link>
              <ThemeToggle />
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
