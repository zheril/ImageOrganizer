"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI, type GridDensity, type SortKey, type MediaFilter, type ViewKey } from "@/lib/store/ui";
import { useViewLabel } from "@/lib/store/config";
import { cn } from "@/lib/utils";
import {
  Search, ChevronDown, ArrowDownUp, Filter, LayoutGrid, Grid2x2, Grid3x3,
  Heart, Star, FolderOpen, Trash2, Sparkles, X, Images, Film, MousePointerClick,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TopBar() {
  const { view, params, breadcrumbs, search, setSearch, density, setDensity, sort, sortDir, setSort, filter, setFilter, openAssignDialog, selectedIds, selectMode, toggleSelectMode } = useUI();

  const inboxCount = useLiveQuery(async () => {
    const arr = await db.media.toArray();
    return arr.filter((m) => !m.cosplayerId || !m.characterId || !m.setId).length;
  });

  const viewLabelStr = useViewLabel(view as ViewKey);
  const title = breadcrumbs[breadcrumbs.length - 1]?.label || viewLabelStr;

  // Views that show media grids (where select mode + bulk actions make sense)
  const isGridView = ["all", "inbox", "favorites", "recently-added", "recently-viewed", "sets"].includes(view);

  return (
    <header className="flex flex-col border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/50 sticky top-0 z-20">
      {/* Top row */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Title */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold truncate">{title}</h1>
            {view === "inbox" && inboxCount !== undefined && inboxCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/15 text-amber-500 font-medium">
                {inboxCount} unorganized
              </span>
            )}
          </div>
        </div>

        {/* Select mode toggle — only in grid views */}
        {isGridView && (
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1 ml-1"
            onClick={toggleSelectMode}
            title="Toggle select mode (single click selects instead of opening viewer)"
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            {selectMode ? "Selecting" : "Select"}
          </Button>
        )}

        {/* Search */}
        <div className="relative ml-auto w-72 max-w-[40vw]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media…"
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Density toggle */}
        <ToggleGroup
          type="single"
          value={density}
          onValueChange={(v) => v && setDensity(v as GridDensity)}
          className="border rounded-md h-9"
          size="sm"
        >
          <ToggleGroupItem value="small" aria-label="Small grid" className="px-2">
            <Grid3x3 className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="medium" aria-label="Medium grid" className="px-2">
            <Grid2x2 className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="large" aria-label="Large grid" className="px-2">
            <LayoutGrid className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <ArrowDownUp className="h-3.5 w-3.5" />
              Sort
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["imported","name","date-taken","rating","size"] as SortKey[]).map((k) => (
              <DropdownMenuItem
                key={k}
                onClick={() => setSort(k)}
                className={cn("justify-between", sort === k && "bg-accent")}
              >
                <span>{sortLabel(k)}</span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {sort === k ? sortDir : "—"}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <Filter className="h-3.5 w-3.5" />
              {filter === "all" ? "All" : filter}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {([
              { v: "all", l: "All media", icon: Images },
              { v: "image", l: "Photos", icon: Images },
              { v: "video", l: "Videos", icon: Film },
              { v: "favorite", l: "Favorites", icon: Heart },
            ] as { v: MediaFilter; l: string; icon: typeof Images }[]).map((opt) => (
              <DropdownMenuItem
                key={opt.v}
                onClick={() => setFilter(opt.v)}
                className={cn("gap-2", filter === opt.v && "bg-accent")}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Context toolbar — shown when items selected */}
      {selectedIds.size > 0 && (
        <ContextToolbar />
      )}
    </header>
  );
}

function ContextToolbar() {
  const { selectedIds, clearSelection, openAssignDialog } = useUI();
  const count = selectedIds.size;
  const [busy, setBusy] = useState(false);
  const ids = Array.from(selectedIds);

  async function favoriteAll(value: boolean) {
    setBusy(true);
    try {
      for (const id of ids) {
        await db.media.update(id, { favorite: value });
      }
    } finally { setBusy(false); }
  }
  async function rateAll(rating: number) {
    setBusy(true);
    try {
      for (const id of ids) {
        await db.media.update(id, { rating });
      }
    } finally { setBusy(false); }
  }
  async function sendToInbox() {
    setBusy(true);
    try {
      for (const id of ids) {
        await db.media.update(id, {
          cosplayerId: undefined, characterId: undefined, setId: undefined,
        });
      }
    } finally { setBusy(false); }
  }
  async function deleteFromLibrary() {
    if (!confirm(`Remove ${count} media from library?\n\n(This does NOT delete the original files on disk — it only removes them from the local database.)`)) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await db.media.delete(id);
      }
      clearSelection();
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-t bg-primary/5 text-sm">
      <div className="inline-flex items-center gap-2">
        <span className="text-xs font-medium">{count} selected</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <Button
        size="sm"
        variant="default"
        onClick={() => openAssignDialog(ids)}
        className="h-7 gap-1"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Assign → Cosplayer / Character / Set
      </Button>
      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => favoriteAll(true)}>
        <Heart className="h-3.5 w-3.5" /> Favorite
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 gap-1">
            <Star className="h-3.5 w-3.5" /> Rate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {[5,4,3,2,1,0].map((r) => (
            <DropdownMenuItem key={r} onClick={() => rateAll(r)} className="gap-2">
              <span className="flex">
                {Array.from({length: 5}).map((_, i) => (
                  <Star key={i} className={cn("h-3 w-3", i < r ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                ))}
              </span>
              <span className="text-xs ml-1">{r === 0 ? "Clear" : `${r}/5`}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={sendToInbox}>
        <FolderOpen className="h-3.5 w-3.5" /> Send to Inbox
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-red-500 gap-1" onClick={deleteFromLibrary}>
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={clearSelection}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function sortLabel(k: SortKey): string {
  switch (k) {
    case "imported": return "Imported date";
    case "name": return "Filename";
    case "date-taken": return "Date taken";
    case "rating": return "Rating";
    case "size": return "File size";
  }
}
