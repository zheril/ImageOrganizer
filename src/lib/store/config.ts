import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewKey } from "@/lib/store/ui";

export type { ViewKey };

// All customizable field labels. Both singular and plural forms so we can
// drop them into any UI string ("New Cosplayer", "Cosplayers", "Pick a Set", etc.)
export interface FieldLabels {
  cosplayer: string;
  cosplayerPlural: string;
  character: string;
  characterPlural: string;
  set: string;
  setPlural: string;
  tag: string;
  tagPlural: string;
  event: string;
  eventPlural: string;
  location: string;
  locationPlural: string;
}

export const DEFAULT_LABELS: FieldLabels = {
  cosplayer: "Cosplayer",
  cosplayerPlural: "Cosplayers",
  character: "Character",
  characterPlural: "Characters",
  set: "Set",
  setPlural: "Sets",
  tag: "Tag",
  tagPlural: "Tags",
  event: "Event",
  eventPlural: "Events",
  location: "Location",
  locationPlural: "Locations",
};

export const DEFAULT_NAV_VISIBILITY: Record<ViewKey, boolean> = {
  all: true,
  inbox: true,
  favorites: true,
  "recently-added": true,
  "recently-viewed": true,
  cosplayers: true,
  characters: true,
  sets: true,
  tags: true,
  events: true,
  locations: true,
  folders: true,
  settings: true,
};

interface ConfigState {
  navVisibility: Record<ViewKey, boolean>;
  fieldLabels: FieldLabels;
  setNavVisibility: (key: ViewKey, visible: boolean) => void;
  setFieldLabel: (field: keyof FieldLabels, value: string) => void;
  resetConfig: () => void;
}

export const useConfig = create<ConfigState>()(
  persist(
    (set) => ({
      navVisibility: { ...DEFAULT_NAV_VISIBILITY },
      fieldLabels: { ...DEFAULT_LABELS },
      setNavVisibility: (key, visible) =>
        set((s) => ({
          navVisibility: { ...s.navVisibility, [key]: visible },
        })),
      setFieldLabel: (field, value) =>
        set((s) => ({
          fieldLabels: { ...s.fieldLabels, [field]: value },
        })),
      resetConfig: () =>
        set({
          navVisibility: { ...DEFAULT_NAV_VISIBILITY },
          fieldLabels: { ...DEFAULT_LABELS },
        }),
    }),
    {
      name: "cosvault-config",
      version: 1,
    },
  ),
);

// Helper hook for getting a label reactively
export function useFieldLabel(field: keyof FieldLabels): string {
  return useConfig((s) => s.fieldLabels[field]);
}

// Map a view key to its plural label
export function useViewLabel(view: ViewKey): string {
  const labels = useConfig((s) => s.fieldLabels);
  switch (view) {
    case "cosplayers":
      return labels.cosplayerPlural;
    case "characters":
      return labels.characterPlural;
    case "sets":
      return labels.setPlural;
    case "tags":
      return labels.tagPlural;
    case "events":
      return labels.eventPlural;
    case "locations":
      return labels.locationPlural;
    case "all":
      return "All Media";
    case "inbox":
      return "Inbox";
    case "favorites":
      return "Favorites";
    case "recently-added":
      return "Recently Added";
    case "recently-viewed":
      return "Recently Viewed";
    case "folders":
      return "Folders";
    case "settings":
      return "Settings";
  }
}
