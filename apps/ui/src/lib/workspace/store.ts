import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// A VS Code-style workspace: the project opens as tabs in the main area. The
// sidebar explorer and the tab bar share this store, so clicking a file, a
// notebook, or a view opens/focuses a tab rather than navigating away. Open
// tabs + the active tab persist (localStorage) so a reload restores the
// workspace exactly where you left it.

export type TabKind =
  | 'work'
  | 'knowledge'
  | 'settings'
  | 'notebook'
  | 'file'
  | 'session';

export interface WorkspaceTab {
  key: string; // unique + stable per tab (singletons use their kind)
  kind: TabKind;
  title: string;
  closeable?: boolean;
  protocolId?: string; // notebook tabs
  filePath?: string; // file tabs
  nodeId?: string; // file tabs (the OKF node behind the file, for editing)
  nodeType?: string; // file tabs (directory label)
  editable?: boolean; // file tabs (author-first markdown can be edited)
  goal?: string; // session tabs
  sessionId?: string; // session tabs (persisted AgentSession id)
}

interface WorkspaceState {
  projectId: string | null;
  tabs: WorkspaceTab[];
  activeKey: string | null;
  // Bumped whenever the graph mutates, so the sidebar file/notebook lists can
  // refetch without prop-drilling.
  graphVersion: number;
  setProject: (id: string) => void;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (key: string) => void;
  setActive: (key: string) => void;
  bumpGraph: () => void;
}

// "Work" is the project's home tab — the main view where sessions start. It's
// always present and never closes.
const homeTab = (): WorkspaceTab => ({
  key: 'work',
  kind: 'work',
  title: 'Work',
  closeable: false,
});

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      projectId: null,
      tabs: [],
      activeKey: null,
      graphVersion: 0,
      setProject: (id) =>
        set((s) => {
          // Same project as the persisted one → keep restored tabs; otherwise
          // start fresh at the home tab.
          if (s.projectId === id && s.tabs.length) return { projectId: id };
          const home = homeTab();
          return { projectId: id, tabs: [home], activeKey: home.key };
        }),
      openTab: (tab) =>
        set((s) => {
          if (s.tabs.some((t) => t.key === tab.key)) return { activeKey: tab.key };
          return { tabs: [...s.tabs, tab], activeKey: tab.key };
        }),
      closeTab: (key) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.key === key);
          if (idx === -1) return s;
          const tabs = s.tabs.filter((t) => t.key !== key);
          let activeKey = s.activeKey;
          if (activeKey === key) {
            activeKey = tabs.length
              ? tabs[Math.min(idx, tabs.length - 1)].key
              : null;
          }
          return { tabs, activeKey };
        }),
      setActive: (key) => set({ activeKey: key }),
      bumpGraph: () => set((s) => ({ graphVersion: s.graphVersion + 1 })),
    }),
    {
      name: 'labda-workspace',
      storage: createJSONStorage(() => localStorage),
      // Only the tab layout persists — not the volatile graph counter.
      partialize: (s) => ({
        projectId: s.projectId,
        tabs: s.tabs,
        activeKey: s.activeKey,
      }),
    },
  ),
);
