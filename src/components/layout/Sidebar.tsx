"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI, type ViewKey } from "@/lib/store/ui";
import { useConfig, type FieldLabels } from "@/lib/store/config";
import { cn } from "@/lib/utils";
import {
  Images, Inbox, Heart, Clock, Eye, Users, Drama, FolderClosed,
  Tag, Calendar, MapPin, FolderOpen, Settings, Sparkles, X,
} from "lucide-react";

interface NavItem {
  key: ViewKey;
  // When provided, overrides the static `label` with one computed from current config.
  labelFromConfig?: (labels: FieldLabels) => string;
  // Static fallback label (for items whose name doesn't change: All Media, Inbox, etc.)
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countQuery?: () => Promise<number>;
}

const LIBRARY: NavItem[] = [
  { key: "all", label: "All Media", icon: Images, countQuery: () => db.media.count() },
  { key: "inbox", label: "Inbox", icon: Inbox, countQuery: async () => {
    const arr = await db.media.toArray();
    return arr.filter((m) => !m.cosplayerId || !m.characterId || !m.setId).length;
  }},
  { key: "favorites", label: "Favorites", icon: Heart, countQuery: async () => {
    const arr = await db.media.toArray();
    return arr.filter((m) => m.favorite).length;
  }},
  { key: "recently-added", label: "Recently Added", icon: Clock },
  { key: "recently-viewed", label: "Recently Viewed", icon: Eye },
];

const COSPLAY: NavItem[] = [
  {
    key: "cosplayers",
    label: "Cosplayers",
    labelFromConfig: (l) => l.cosplayerPlural,
    icon: Users,
    countQuery: () => db.cosplayers.count(),
  },
  {
    key: "characters",
    label: "Characters",
    labelFromConfig: (l) => l.characterPlural,
    icon: Drama,
    countQuery: () => db.characters.count(),
  },
  {
    key: "sets",
    label: "Sets",
    labelFromConfig: (l) => l.setPlural,
    icon: FolderClosed,
    countQuery: () => db.sets.count(),
  },
];

const DISCOVER: NavItem[] = [
  {
    key: "tags",
    label: "Tags",
    labelFromConfig: (l) => l.tagPlural,
    icon: Tag,
    countQuery: () => db.tags.count(),
  },
  {
    key: "events",
    label: "Events",
    labelFromConfig: (l) => l.eventPlural,
    icon: Calendar,
  },
  {
    key: "locations",
    label: "Locations",
    labelFromConfig: (l) => l.locationPlural,
    icon: MapPin,
  },
];

const SYSTEM: NavItem[] = [
  { key: "folders", label: "Folders", icon: FolderOpen, countQuery: () => db.folders.count() },
  { key: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { view, navigate, params } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  const navVisibility = useConfig((s) => s.navVisibility);

  // Filter hidden items + apply custom labels
  const filterAndLabel = (items: NavItem[]): NavItem[] =>
    items
      .filter((it) => navVisibility[it.key] !== false)
      .map((it) => ({
        ...it,
        label: it.labelFromConfig ? it.labelFromConfig(labels) : it.label,
      }));

  return (
    <aside className="w-64 shrink-0 bg-muted/30 border-r border-border flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight">Cosvault</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Local Library</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        <NavSection title="Library" items={filterAndLabel(LIBRARY)} activeView={view} onNavigate={navigate} />
        <NavSection title="Cosplay" items={filterAndLabel(COSPLAY)} activeView={view} onNavigate={navigate} />
        <NavSection title="Discover" items={filterAndLabel(DISCOVER)} activeView={view} onNavigate={navigate} />
        <NavSection title="System" items={filterAndLabel(SYSTEM)} activeView={view} onNavigate={navigate} />
      </nav>

      <div className="px-3 py-3 border-t border-border text-[10px] text-muted-foreground/70">
        Local-first · Your files never leave your device
      </div>
    </aside>
  );
}

function NavSection({
  title, items, activeView, onNavigate,
}: {
  title: string;
  items: NavItem[];
  activeView: ViewKey;
  onNavigate: (v: ViewKey, p?: Record<string, string>) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-2 mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.key} item={item} active={activeView === item.key} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function NavLink({
  item, active, onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (v: ViewKey, p?: Record<string, string>) => void;
}) {
  const count = useLiveQuery(() => item.countQuery?.() ?? Promise.resolve(undefined), [item.key], undefined);
  const Icon = item.icon;
  return (
    <li>
      <button
        onClick={() => onNavigate(item.key, {})}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition",
          active
            ? "bg-background shadow-sm text-foreground font-medium"
            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4", active && "text-primary")} />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] text-muted-foreground/70 tabular-nums">{count}</span>
        )}
      </button>
    </li>
  );
}
