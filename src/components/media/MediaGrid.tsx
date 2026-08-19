"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import { db, type Media } from "@/lib/db/dexie";
import { useUI, type GridDensity, type SortKey, type MediaFilter } from "@/lib/store/ui";
import { MediaThumbnail } from "./MediaThumbnail";
import { Check, Heart, Star, Film, ImageOff, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DENSITY_COL: Record<GridDensity, number> = {
  small: 8, // 8 cols on desktop
  medium: 6,
  large: 4,
};
const DENSITY_GAP: Record<GridDensity, number> = {
  small: 4,
  medium: 6,
  large: 10,
};
const DENSITY_RADIUS: Record<GridDensity, string> = {
  small: "rounded-md",
  medium: "rounded-lg",
  large: "rounded-xl",
};

interface Query {
  cosplayerId?: string;
  characterId?: string;
  setId?: string;
  tagId?: string;
  folderId?: string;
  inboxOnly?: boolean;
  favoritesOnly?: boolean;
  recentlyAdded?: boolean;
  recentlyViewed?: boolean;
}

export function MediaGrid({ query = {} }: { query?: Query }) {
  const { density, sort, sortDir, filter, search, selectedIds, toggleSelect, openViewer } =
    useUI();
  const containerRef = useRef<HTMLDivElement>(null);

  // Build media list
  const allMedia = useLiveQuery(async () => {
    let coll = db.media.toCollection();
    let arr = await coll.toArray();
    if (query.cosplayerId) arr = arr.filter((m) => m.cosplayerId === query.cosplayerId);
    if (query.characterId) arr = arr.filter((m) => m.characterId === query.characterId);
    if (query.setId) arr = arr.filter((m) => m.setId === query.setId);
    if (query.folderId) arr = arr.filter((m) => m.folderId === query.folderId);
    if (query.inboxOnly) arr = arr.filter((m) => !m.cosplayerId || !m.characterId || !m.setId);
    if (query.favoritesOnly) arr = arr.filter((m) => m.favorite);
    if (query.recentlyAdded) {
      arr = arr.filter((m) => m.importedAt);
      arr = arr.sort((a, b) => b.importedAt - a.importedAt).slice(0, 200);
    }
    if (query.recentlyViewed) {
      arr = arr.filter((m) => m.lastViewedAt);
      arr = arr.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)).slice(0, 200);
    }
    if (query.tagId) arr = arr.filter((m) => m.tags.includes(query.tagId!));
    if (filter === "image") arr = arr.filter((m) => m.kind === "image");
    if (filter === "video") arr = arr.filter((m) => m.kind === "video");
    if (filter === "favorite") arr = arr.filter((m) => m.favorite);

    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter((m) => {
        return (
          m.filename.toLowerCase().includes(s) ||
          m.tags.some((t) => t.includes(s)) // crude — would need tag name lookup
        );
      });
    }

    // Sort
    arr.sort((a, b) => {
      let r = 0;
      switch (sort) {
        case "imported": r = a.importedAt - b.importedAt; break;
        case "name": r = a.filename.localeCompare(b.filename); break;
        case "date-taken": r = (a.fileCreated || 0) - (b.fileCreated || 0); break;
        case "rating": r = a.rating - b.rating; break;
        case "size": r = a.fileSize - b.fileSize; break;
      }
      return sortDir === "asc" ? r : -r;
    });
    return arr;
  }, [JSON.stringify(query), filter, sort, sortDir, search]);

  const list = allMedia ?? [];
  const listIds = useMemo(() => list.map((m) => m.id), [list]);

  // Virtualization: compute row count based on container width
  const [cols, setCols] = useState(6);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      // Approximate gap and min col width to compute
      const gap = DENSITY_GAP[density];
      const minColWidth = density === "small" ? 90 : density === "medium" ? 160 : 240;
      const n = Math.max(2, Math.floor((w + gap) / (minColWidth + gap)));
      setCols(n);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [density]);

  const rows = useMemo(() => {
    const n = cols || 1;
    const r: Media[][] = [];
    for (let i = 0; i < list.length; i += n) {
      r.push(list.slice(i, i + n));
    }
    return r;
  }, [list, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => {
      const w = containerRef.current?.clientWidth ?? 800;
      const gap = DENSITY_GAP[density];
      const n = cols || 1;
      const cellW = (w - gap * (n - 1)) / n;
      // 4:3 aspect ratio for cells
      return cellW * 0.75 + gap;
    },
    overscan: 4,
  });

  const lastRangeStartRef = useRef<number | null>(null);

  if (!allMedia) {
    return (
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="rounded-full bg-muted/40 p-4 mb-4">
          <ImageOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No media found here yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {search.trim()
            ? "Try clearing the search or adjust your filters."
            : "Go to Folders in the sidebar to link a folder on your computer."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1"
          onClick={() => useUI.getState().navigate("folders")}
        >
          <FolderOpen className="h-3.5 w-3.5" /> Watch a folder
        </Button>
      </div>
    );
  }

  const gap = DENSITY_GAP[density];
  const radius = DENSITY_RADIUS[density];

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto px-4 pb-24 pt-2"
      style={{ contain: "strict" }}
      onClick={(e) => {
        // Click on empty space clears selection
        if (e.target === e.currentTarget) useUI.getState().clearSelection();
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((vRow) => {
          const row = rows[vRow.index];
          if (!row) return null;
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 right-0"
              style={{ transform: `translateY(${vRow.start}px)` }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: `${gap}px`,
                  height: "100%",
                }}
              >
                {row.map((m, i) => {
                  const idx = vRow.index * cols + i;
                  const selected = selectedIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        const { selectMode } = useUI.getState();
                        // In select mode: regular click toggles selection
                        // Otherwise: modifier-click (shift/cmd/ctrl) selects, plain click opens viewer
                        if (selectMode || e.shiftKey || e.metaKey || e.ctrlKey) {
                          if (e.shiftKey && lastRangeStartRef.current !== null) {
                            const start = Math.min(lastRangeStartRef.current, idx);
                            const end = Math.max(lastRangeStartRef.current, idx);
                            const ids = list.slice(start, end + 1).map((mm) => mm.id);
                            useUI.getState().selectMany(ids);
                          } else {
                            toggleSelect(m.id);
                            lastRangeStartRef.current = idx;
                          }
                        } else {
                          openViewer(m.id, listIds);
                          db.media.update(m.id, { lastViewedAt: Date.now() });
                        }
                      }}
                      className={cn(
                        "group relative cursor-pointer overflow-hidden",
                        "ring-offset-2 ring-offset-background",
                        radius,
                        selected
                          ? "ring-2 ring-primary"
                          : "ring-0 hover:ring-1 hover:ring-foreground/20",
                      )}
                    >
                      <MediaThumbnail
                        key={m.id + density}
                        media={m}
                        size={density === "small" ? "tiny" : density === "medium" ? "medium" : "large"}
                        className="aspect-[4/3] w-full"
                        alt={m.filename}
                      />
                      {/* Overlay gradient */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Top-left badges */}
                      <div className="pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-1">
                        {m.kind === "video" && (
                          <span className="bg-black/60 rounded-full p-1 backdrop-blur-sm">
                            <Film className="h-3 w-3 text-white" />
                          </span>
                        )}
                        {m.favorite && (
                          <span className="bg-black/60 rounded-full p-1 backdrop-blur-sm">
                            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                          </span>
                        )}
                      </div>

                      {/* Top-right rating */}
                      {m.rating > 0 && (
                        <div className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 rounded-full px-1.5 py-0.5 backdrop-blur-sm">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-medium text-white">{m.rating}</span>
                        </div>
                      )}

                      {/* Selected check */}
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 grid place-items-center rounded-full bg-primary h-5 w-5 shadow">
                          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}

                      {/* Filename on hover */}
                      {density !== "small" && (
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] font-mono text-white/90 truncate">{m.filename}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
