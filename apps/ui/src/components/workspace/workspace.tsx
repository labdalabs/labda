'use client';

import { useEffect } from 'react';
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
  const tabs = useWorkspace((s) => s.tabs);
  const activeKey = useWorkspace((s) => s.activeKey);
  const setProject = useWorkspace((s) => s.setProject);
  const setActive = useWorkspace((s) => s.setActive);
  const closeTab = useWorkspace((s) => s.closeTab);

  useEffect(() => {
    setProject(projectId);
  }, [projectId, setProject]);

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
              role="tab"
              aria-selected={active}
              data-testid="tab"
              data-tab-key={t.key}
              onClick={() => setActive(t.key)}
              className={`group flex min-w-0 max-w-52 shrink-0 cursor-pointer items-center gap-2 border-r px-3 text-sm ${
                active
                  ? 'bg-background font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-background/50'
              }`}
            >
              <span className="truncate">{t.title}</span>
              {t.closeable !== false && (
                <button
                  type="button"
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.key);
                  }}
                  className="rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1">
        {tabs.map((t) => (
          <div
            key={t.key}
            className={
              t.key === activeKey ? 'absolute inset-0 overflow-auto' : 'hidden'
            }
          >
            {t.kind === 'knowledge' ? (
              <KnowledgeBoard projectId={projectId} />
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
        ))}
      </div>
    </div>
  );
}
