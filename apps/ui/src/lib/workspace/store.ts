import { create } from 'zustand';

// A VS Code-style workspace: the project opens as tabs in the main area. The
// sidebar explorer and the tab bar share this store, so clicking a file, a
// notebook, or a view opens/focuses a tab rather than navigating away.

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
  nodeId?: string; // file tabs (the OKF node behind the file)
  nodeType?: string; // file tabs
  content?: string; // file tabs (the markdown body)
  goal?: string; // session tabs
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

export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: null,
  tabs: [],
  activeKey: null,
  graphVersion: 0,
  setProject: (id) =>
    set((s) => {
      if (s.projectId === id) return s;
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
        activeKey = tabs.length ? tabs[Math.min(idx, tabs.length - 1)].key : null;
      }
      return { tabs, activeKey };
    }),
  setActive: (key) => set({ activeKey: key }),
  bumpGraph: () => set((s) => ({ graphVersion: s.graphVersion + 1 })),
}));
