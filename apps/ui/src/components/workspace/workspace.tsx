'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProject } from '@/lib/research/queries';
import { useWorkspace } from '@/lib/workspace/store';
import { KnowledgeBoard } from '@/components/knowledge/knowledge-board';
import { ProjectSettings } from '@/components/research/project-settings';
import { NotebookEditor } from '@/components/protocol/notebook-editor';
import { ProjectHome } from './project-home';
import { OkfFileView } from './okf-file-view';
import { SessionChat } from './session-chat';

// The tabbed project workspace (VS Code-style). The sidebar explorer opens tabs
// here; each open tab stays mounted (so notebooks, sessions, and the board keep
// their state when you switch), and only the active one is shown.
export function Workspace({ projectId }: { projectId: string }) {
  const storeProjectId = useWorkspace((s) => s.projectId);
  const tabs = useWorkspace((s) => s.tabs);
  const activeKey = useWorkspace((s) => s.activeKey);
  const setProject = useWorkspace((s) => s.setProject);
  const setActive = useWorkspace((s) => s.setActive);
  const closeTab = useWorkspace((s) => s.closeTab);

  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>(
    'checking',
  );

  useEffect(() => {
    setProject(projectId);
  }, [projectId, setProject]);

  // Verify access up front so an inaccessible/deleted project shows a real
  // message instead of an empty shell (every data call swallows its error).
  useEffect(() => {
    let live = true;
    setAccess('checking');
    getProject(projectId)
      .then(() => live && setAccess('ok'))
      .catch(() => live && setAccess('denied'));
    return () => {
      live = false;
    };
  }, [projectId]);

  if (access === 'denied') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold">Project not available</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or you don&rsquo;t have access. Ask the owner
          to share it with you.
        </p>
        <Link
          href="/app"
          className="text-sm font-medium text-brand-sky underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  // Until the store has switched to this project, don't render — otherwise the
  // previous project's tabs (and their data fetches) would briefly mount here.
  if (storeProjectId !== projectId || access === 'checking') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        data-testid="tab-bar"
        className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/20"
      >
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <div
              key={t.key}
              data-testid="tab"
              data-tab-key={t.key}
              className={`group relative flex min-w-0 max-w-52 shrink-0 items-center border-r ${
                active ? 'bg-background' : 'hover:bg-background/50'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setActive(t.key)}
                className={`flex min-w-0 items-center py-2 pl-3 text-sm ${
                  t.closeable === false ? 'pr-3' : 'pr-1'
                } ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
              >
                <span className="truncate">{t.title}</span>
              </button>
              {t.closeable !== false && (
                <button
                  type="button"
                  aria-label="Close tab"
                  onClick={() => closeTab(t.key)}
                  className="mr-1.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 opacity-60 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3 w-3" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-sky" />
              )}
            </div>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1">
        {tabs.map((t) => {
          const isActive = t.key === activeKey;
          // Session (EVE runtime) and notebook (kernel) tabs are expensive, so
          // mount them only while active — they rehydrate from persisted state
          // on return. Light tabs stay mounted to keep their in-memory state.
          const heavy = t.kind === 'session' || t.kind === 'notebook';
          if (heavy && !isActive) return null;
          return (
            <div
              key={t.key}
              className={isActive ? 'absolute inset-0 overflow-auto' : 'hidden'}
            >
            {t.kind === 'knowledge' ? (
              <KnowledgeBoard
                projectId={projectId}
                active={t.key === activeKey}
              />
            ) : t.kind === 'work' ? (
              <ProjectHome projectId={projectId} />
            ) : t.kind === 'settings' ? (
              <ProjectSettings projectId={projectId} />
            ) : t.kind === 'notebook' && t.protocolId ? (
              <NotebookEditor protocolId={t.protocolId} projectId={projectId} />
            ) : t.kind === 'file' ? (
              <OkfFileView tab={t} />
            ) : t.kind === 'session' && t.sessionId ? (
              <SessionChat
                projectId={projectId}
                sessionId={t.sessionId}
                goal={t.goal}
              />
            ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
