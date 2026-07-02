'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getProject, listProjects } from '@/lib/research/queries';
import { listProtocols } from '@/lib/protocol/queries';
import type { Hypothesis, Project } from '@/lib/research/types';
import type { Protocol } from '@/lib/protocol/types';

// A persistent Linear/IDE-style shell: a left panel that manages the workspace
// (project switcher) and, inside a project, its artifacts (hypotheses,
// notebooks, docs) plus the project-scoped views. Content renders in <main>.

const PROJECT_RE = /^\/app\/projects\/([^/]+)/;

// 16px stroke icons — quiet, consistent, IDE-flavored.
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
  overview: 'M4 6h16M4 12h16M4 18h10',
  graph: 'M6 6h.01M18 6h.01M12 18h.01M6 6l6 12M18 6l-6 12',
  assistant: 'M12 3l1.9 4.3L18 9l-4.1 1.7L12 15l-1.9-4.3L6 9l4.1-1.7zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z',
  hypothesis: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z',
  notebook: 'M8 3v18M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  doc: 'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v4h4',
  signout: 'M15 12H4m0 0 4-4m-4 4 4 4M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4',
} as const;

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: keyof typeof ICONS;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      <Icon path={ICONS[icon]} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function TreeSection({
  icon,
  title,
  count,
  children,
}: {
  icon: keyof typeof ICONS;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 px-2.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon path={ICONS[icon]} className="h-3.5 w-3.5" />
        <span>{title}</span>
        {count !== undefined && <span className="text-muted-foreground/70">{count}</span>}
      </div>
      {children}
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
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);

  useEffect(() => {
    if (!email) return;
    listProjects().then(setProjects).catch(() => undefined);
  }, [email]);

  useEffect(() => {
    if (!email || !projectId) {
      setHypotheses([]);
      setProtocols([]);
      return;
    }
    let live = true;
    getProject(projectId)
      .then((p) => live && setHypotheses(p.hypotheses ?? []))
      .catch(() => undefined);
    listProtocols(projectId)
      .then((p) => live && setProtocols(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [email, projectId, pathname]);

  const activeProject = projects.find((p) => p.id === projectId);
  const base = projectId ? `/app/projects/${projectId}` : '';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-black/[0.06] bg-muted/30">
        {/* Brand */}
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
          <NavItem
            href="/app"
            icon="projects"
            label="Projects"
            active={pathname === '/app'}
          />

          {projectId && (
            <div className="mt-4 space-y-0.5">
              <div className="truncate px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {activeProject?.title ?? 'Project'}
              </div>

              <NavItem
                href={base}
                icon="overview"
                label="Overview"
                active={pathname === base}
              />
              <NavItem
                href={`${base}/graph`}
                icon="graph"
                label="Knowledge graph"
                active={pathname === `${base}/graph`}
              />
              <NavItem
                href={`${base}/assistant`}
                icon="assistant"
                label="Assistant"
                active={pathname === `${base}/assistant`}
              />

              <TreeSection icon="hypothesis" title="Hypotheses" count={hypotheses.length}>
                {hypotheses.length === 0 ? (
                  <p className="px-2.5 py-1 text-xs text-muted-foreground/70">None yet</p>
                ) : (
                  hypotheses.map((h) => (
                    <Link
                      key={h.id}
                      href={base}
                      className="block truncate rounded-md px-2.5 py-1 pl-8 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      title={h.statement}
                    >
                      {h.statement}
                    </Link>
                  ))
                )}
              </TreeSection>

              <TreeSection icon="notebook" title="Notebooks" count={protocols.length}>
                {protocols.length === 0 ? (
                  <p className="px-2.5 py-1 text-xs text-muted-foreground/70">None yet</p>
                ) : (
                  protocols.map((p) => {
                    const href = `${base}/protocols/${p.id}`;
                    return (
                      <Link
                        key={p.id}
                        href={href}
                        className={`block truncate rounded-md px-2.5 py-1 pl-8 text-xs hover:bg-muted/60 hover:text-foreground ${
                          pathname === href
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground'
                        }`}
                        title={p.title}
                      >
                        {p.title}
                      </Link>
                    );
                  })
                )}
              </TreeSection>

              <TreeSection icon="doc" title="Docs">
                <p className="px-2.5 py-1 text-xs text-muted-foreground/70">
                  Coming soon
                </p>
              </TreeSection>
            </div>
          )}
        </nav>

        {/* Identity */}
        <div className="border-t border-black/[0.06] p-3">
          {email ? (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-sky/15 text-xs font-medium text-brand-sky">
                {email[0]?.toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {email}
              </span>
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
            <Link
              href="/auth/sign-in"
              className="flex items-center justify-center rounded-md bg-brand-sky px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-sky/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
