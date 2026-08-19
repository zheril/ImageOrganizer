import { create } from "zustand";
// Import the config store so we can read custom labels non-reactively in
// `viewLabel()` below. config.ts only imports `ViewKey` from this file as a
// type (no runtime circular dependency).
import { useConfig } from "@/lib/store/config";

export type ViewKey =
  | "all"
  | "inbox"
  | "favorites"
  | "recently-added"
  | "recently-viewed"
  | "cosplayers"
  | "characters"
  | "sets"
  | "tags"
  | "events"
  | "locations"
  | "folders"
  | "settings";

export type GridDensity = "small" | "medium" | "large";
export type SortKey = "imported" | "name" | "date-taken" | "rating" | "size";
export type SortDir = "asc" | "desc";
export type MediaFilter = "all" | "image" | "video" | "favorite";

interface Crumb {
  label: string;
  view?: ViewKey;
  params?: Record<string, string>;
}

interface ViewerState {
  open: boolean;
  mediaId?: string;
  // A list context so arrows can navigate within a query
  listIds?: string[];
}

interface UIState {
  // Navigation
  view: ViewKey;
  params: Record<string, string>;
  breadcrumbs: Crumb[];
  navigate: (view: ViewKey, params?: Record<string, string>, label?: string) => void;
  setBreadcrumbs: (b: Crumb[]) => void;

  // Selection
  selectMode: boolean;
  toggleSelectMode: () => void;
  setSelectMode: (b: boolean) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectRange: (ids: string[]) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  lastSelectedId: string | null;

  // Grid
  density: GridDensity;
  setDensity: (d: GridDensity) => void;
  sort: SortKey;
  sortDir: SortDir;
  setSort: (s: SortKey, d?: SortDir) => void;
  filter: MediaFilter;
  setFilter: (f: MediaFilter) => void;
  search: string;
  setSearch: (s: string) => void;

  // Viewer
  viewer: ViewerState;
  openViewer: (mediaId: string, listIds?: string[]) => void;
  closeViewer: () => void;

  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;

  // Side panel (task progress)
  taskPanelOpen: boolean;
  setTaskPanel: (open: boolean) => void;

  // Assign dialog
  assignDialogOpen: boolean;
  assignDialogIds: string[];
  openAssignDialog: (ids: string[]) => void;
  closeAssignDialog: () => void;

  // Edit dialog (for cosplayer/character/set editing)
  editDialog: {
    open: boolean;
    type: "cosplayer" | "character" | "set" | null;
    id?: string;
  };
  openEditDialog: (type: "cosplayer" | "character" | "set", id: string) => void;
  closeEditDialog: () => void;
}

export const useUI = create<UIState>((set, get) => ({
  view: "all",
  params: {},
  breadcrumbs: [{ label: "All Media" }],
  navigate: (view, params = {}, label) =>
    set({
      view,
      params,
      selectedIds: new Set(),
      lastSelectedId: null,
      breadcrumbs: label
        ? [{ label, view, params }]
        : [{ label: viewLabel(view) }],
    }),
  setBreadcrumbs: (b) => set({ breadcrumbs: b }),

  selectMode: false,
  toggleSelectMode: () => set((st) => ({ selectMode: !st.selectMode, selectedIds: new Set() })),
  setSelectMode: (b) => set({ selectMode: b, selectedIds: new Set() }),

  selectedIds: new Set(),
  lastSelectedId: null,
  toggleSelect: (id) => {
    const s = new Set(get().selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set({ selectedIds: s, lastSelectedId: id });
  },
  selectRange: (ids) => {
    const s = new Set(get().selectedIds);
    for (const id of ids) s.add(id);
    set({ selectedIds: s });
  },
  selectMany: (ids) => set({ selectedIds: new Set(ids), lastSelectedId: ids[0] ?? null }),
  clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),
  selectAll: (ids) => set({ selectedIds: new Set(ids), lastSelectedId: ids[0] ?? null }),

  density: "medium",
  setDensity: (d) => set({ density: d }),
  sort: "imported",
  sortDir: "desc",
  setSort: (s, d) =>
    set((st) => ({
      sort: s,
      sortDir: d ?? (s === st.sort ? (st.sortDir === "asc" ? "desc" : "asc") : "desc"),
    })),
  filter: "all",
  setFilter: (f) => set({ filter: f }),
  search: "",
  setSearch: (s) => set({ search: s }),

  viewer: { open: false },
  openViewer: (mediaId, listIds) => set({ viewer: { open: true, mediaId, listIds } }),
  closeViewer: () => set({ viewer: { open: false } }),

  theme: "dark",
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

  taskPanelOpen: false,
  setTaskPanel: (open) => set({ taskPanelOpen: open }),

  assignDialogOpen: false,
  assignDialogIds: [],
  openAssignDialog: (ids) => set({ assignDialogOpen: true, assignDialogIds: ids }),
  closeAssignDialog: () => set({ assignDialogOpen: false, assignDialogIds: [] }),

  editDialog: { open: false, type: null },
  openEditDialog: (type, id) => set({ editDialog: { open: true, type, id } }),
  closeEditDialog: () => set({ editDialog: { open: false, type: null } }),
}));

// (Top-of-file import for useConfig is at the top of this file.)

export function viewLabel(v: ViewKey): string {
  // Read current config labels non-reactively (used by navigate() to set
  // the initial breadcrumb label). Components that need to re-render on
  // label change should use `useViewLabel` from `@/lib/store/config`.
  const labels = useConfig.getState()?.fieldLabels;
  switch (v) {
    case "all": return "All Media";
    case "inbox": return "Inbox";
    case "favorites": return "Favorites";
    case "recently-added": return "Recently Added";
    case "recently-viewed": return "Recently Viewed";
    case "cosplayers": return labels?.cosplayerPlural || "Cosplayers";
    case "characters": return labels?.characterPlural || "Characters";
    case "sets": return labels?.setPlural || "Sets";
    case "tags": return labels?.tagPlural || "Tags";
    case "events": return labels?.eventPlural || "Events";
    case "locations": return labels?.locationPlural || "Locations";
    case "folders": return "Folders";
    case "settings": return "Settings";
  }
}
