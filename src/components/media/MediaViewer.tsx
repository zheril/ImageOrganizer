"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Media } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { MediaThumbnail } from "./MediaThumbnail";
import {
  ChevronLeft, ChevronRight, X, Heart, Star, Info,
  ZoomIn, ZoomOut, FolderOpen, Trash2, Shuffle, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, formatDuration } from "@/lib/format";

export function MediaViewer() {
  const { viewer, closeViewer, openAssignDialog } = useUI();
  const [showMeta, setShowMeta] = useState(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false); // hides chrome for immersive viewing

  const media = useLiveQuery(async () => {
    if (!viewer.mediaId) return null;
    return db.media.get(viewer.mediaId);
  }, [viewer.mediaId]);

  const list = viewer.listIds ?? [];

  // For local files, resolve a fresh blob URL on demand (remote seed URLs work directly).
  useEffect(() => {
    if (!media || media.kind !== "video") {
      setVideoUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      if (media.sourceUrl.startsWith("http")) {
        if (!cancelled) setVideoUrl(media.sourceUrl);
        return;
      }
      const { getFileForMedia } = await import("@/lib/fs");
      const file = await getFileForMedia(media);
      if (!file) {
        if (!cancelled) setVideoUrl(null);
        return;
      }
      createdUrl = URL.createObjectURL(file);
      if (!cancelled) setVideoUrl(createdUrl);
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [media?.id, media?.kind, media?.sourceUrl]);

  // Helpers (declared before effects so keyboard handler can reference them)
  function nav(dir: -1 | 1) {
    if (list.length === 0 || !viewer.mediaId) return;
    const i = list.indexOf(viewer.mediaId);
    const next = (i + dir + list.length) % list.length;
    useUI.getState().openViewer(list[next], list);
  }
  function toggleFavorite(m: Media) {
    db.media.update(m.id, { favorite: !m.favorite });
  }
  function setRating(m: Media, r: number) {
    db.media.update(m.id, { rating: r });
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen?.();
        setFocusMode(true); // enter immersive mode when entering fullscreen
      }
    } catch (e) {
      console.warn("Fullscreen failed:", e);
    }
  }

  // Mark viewed when media changes & reset viewer state
  useEffect(() => {
    if (viewer.mediaId) {
      db.media.update(viewer.mediaId, { lastViewedAt: Date.now() }).catch(() => {});
    }
    const handle = requestAnimationFrame(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    });
    return () => cancelAnimationFrame(handle);
  }, [viewer.mediaId]);

  // Detect fullscreen exit via browser UI and turn off focus mode
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!viewer.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (focusMode) {
          setFocusMode(false);
          if (document.fullscreenElement) document.exitFullscreen?.();
        } else {
          closeViewer();
        }
      }
      else if (e.key === "ArrowLeft") nav(-1);
      else if (e.key === "ArrowRight") nav(1);
      else if (e.key === " ") { e.preventDefault(); nav(1); }
      else if (e.key === "f" || e.key === "F") {
        // F = real browser fullscreen + immersive mode
        setFocusMode((f) => !f);
        toggleFullscreen();
      } else if (e.key === "h" || e.key === "H") {
        // H = hide chrome (metadata + top bar + bottom bar) without entering fullscreen
        setFocusMode((f) => !f);
      } else if (e.key === "z" || e.key === "Z") {
        setZoom((z) => (z === 1 ? 2 : z === 2 ? 0.5 : 1));
        setPan({ x: 0, y: 0 });
      } else if (e.key === "i" || e.key === "I") {
        setShowMeta((s) => !s);
      } else if (e.key === "." || e.key === "1") {
        if (media) toggleFavorite(media);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer.open, list, viewer.mediaId, media, focusMode]);

  if (!viewer.open || !media) return null;

  const idx = list.indexOf(media.id);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/95 backdrop-blur-md text-white">
      {/* Image area */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeViewer();
        }}
        onMouseMove={(e) => {
          if (zoom !== 1 && e.buttons === 1) {
            setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
          }
        }}
      >
        {media.kind === "video" ? (
          <video
            key={media.id}
            src={videoUrl || undefined}
            controls
            autoPlay
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="max-h-full max-w-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: "transform 0.1s ease-out",
              cursor: zoom !== 1 ? "grab" : "default",
            }}
          >
            <MediaThumbnail
              key={media.id}
              media={media}
              size="large"
              directFallback={false}
              alt={media.filename}
              className="max-h-[90vh] max-w-[90vw] rounded-md"
            />
          </div>
        )}

        {/* Nav arrows */}
        {list.length > 1 && (
          <>
            <button
              onClick={() => nav(-1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 grid place-items-center h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => nav(1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 grid place-items-center h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Top bar — hidden in focus mode */}
        {!focusMode && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-white/80">{media.filename}</span>
              {media.width && media.height && (
                <span className="text-white/40">
                  {media.width}×{media.height}
                </span>
              )}
              <span className="text-white/40">{formatBytes(media.fileSize)}</span>
              {media.kind === "video" && media.duration && (
                <span className="text-white/40">{formatDuration(media.duration)}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ViewerBtn onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </ViewerBtn>
              <span className="text-xs text-white/60 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <ViewerBtn onClick={() => setZoom((z) => Math.min(5, z + 0.25))}>
                <ZoomIn className="h-4 w-4" />
              </ViewerBtn>
              <ViewerBtn onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                Fit
              </ViewerBtn>
              <ViewerBtn onClick={() => setShowMeta((s) => !s)} title="Toggle info panel (I)">
                <Info className="h-4 w-4" />
              </ViewerBtn>
              <ViewerBtn onClick={() => toggleFavorite(media)} title="Favorite (.)">
                <Heart className={cn("h-4 w-4", media.favorite && "fill-red-500 text-red-500")} />
              </ViewerBtn>
              <ViewerBtn
                onClick={() => openAssignDialog([media.id])}
                title="Reassign to different cosplayer / character / set"
              >
                <Shuffle className="h-4 w-4" />
              </ViewerBtn>
              <ViewerBtn
                onClick={toggleFullscreen}
                title="Fullscreen + immersive mode (F)"
              >
                <Maximize2 className="h-4 w-4" />
              </ViewerBtn>
              <ViewerBtn onClick={closeViewer} title="Close (Esc)">
                <X className="h-4 w-4" />
              </ViewerBtn>
            </div>
          </div>
        )}

        {/* Focus-mode hint */}
        {focusMode && (
          <button
            onClick={() => { setFocusMode(false); if (document.fullscreenElement) document.exitFullscreen?.(); }}
            className="absolute top-3 right-3 z-10 grid place-items-center h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur"
            title="Exit immersive mode (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Bottom controls — hidden in focus mode */}
        {!focusMode && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setRating(media, r)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      "h-5 w-5 transition",
                      r <= media.rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-white/40 hover:text-white",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right meta panel — hidden in focus mode */}
      {showMeta && !focusMode && (
        <aside className="w-72 bg-zinc-900 border-l border-white/10 flex flex-col overflow-auto">
          <div className="p-4 border-b border-white/10">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Filename</p>
            <p className="font-mono text-sm break-all">{media.filename}</p>
          </div>
          <section className="p-4 border-b border-white/10">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Hierarchy</p>
            <HierarchyRow media={media} />
          </section>
          <section className="p-4 border-b border-white/10">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Properties</p>
            <dl className="space-y-1 text-xs">
              <Prop label="Kind">{media.kind}</Prop>
              <Prop label="Dimensions">
                {media.width && media.height ? `${media.width} × ${media.height}` : "—"}
              </Prop>
              <Prop label="File size">{formatBytes(media.fileSize)}</Prop>
              <Prop label="Mime">{media.mimeType}</Prop>
              {media.duration && <Prop label="Duration">{formatDuration(media.duration)}</Prop>}
              <Prop label="Imported">
                {new Date(media.importedAt).toLocaleDateString()}
              </Prop>
              {media.fileCreated && (
                <Prop label="File date">
                  {new Date((media.fileCreated || 0) * 1000).toLocaleString()}
                </Prop>
              )}
            </dl>
          </section>

          {/* Tags */}
          <section className="p-4 border-b border-white/10">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Tags</p>
            <TagEditor media={media} />
          </section>

          {/* EXIF */}
          {media.exif && Object.keys(media.exif).length > 0 && (
            <section className="p-4 border-b border-white/10">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">EXIF</p>
              <dl className="space-y-1 text-xs">
                {media.exif.camera && <Prop label="Camera">{media.exif.camera}</Prop>}
                {media.exif.lens && <Prop label="Lens">{media.exif.lens}</Prop>}
                {media.exif.iso && <Prop label="ISO">{String(media.exif.iso)}</Prop>}
                {media.exif.aperture && <Prop label="Aperture">{media.exif.aperture}</Prop>}
                {media.exif.shutter && <Prop label="Shutter">{media.exif.shutter}</Prop>}
                {media.exif.focalLength && <Prop label="Focal">{media.exif.focalLength}</Prop>}
                {media.exif.takenAt && <Prop label="Taken">{media.exif.takenAt}</Prop>}
              </dl>
            </section>
          )}

          <div className="mt-auto p-4 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => {
                db.media.update(media.id, { cosplayerId: undefined, characterId: undefined, setId: undefined });
              }}
              className="flex items-center justify-center gap-2 rounded-md bg-white/5 hover:bg-white/10 px-3 py-2 text-xs"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Send to Inbox
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove "${media.filename}" from library? (Original file is NOT deleted)`)) {
                  db.media.delete(media.id);
                  closeViewer();
                }
              }}
              className="flex items-center justify-center gap-2 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove from library
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

function ViewerBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="grid place-items-center min-w-9 h-9 px-2 rounded-md bg-white/5 hover:bg-white/15 text-white/90 text-xs"
    >
      {children}
    </button>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/80 text-right truncate max-w-[60%]">{children}</dd>
    </div>
  );
}

function HierarchyRow({ media }: { media: Media }) {
  const cosplayer = useLiveQuery(
    () => (media.cosplayerId ? db.cosplayers.get(media.cosplayerId) : Promise.resolve(null)),
    [media.cosplayerId],
  );
  const character = useLiveQuery(
    () => (media.characterId ? db.characters.get(media.characterId) : Promise.resolve(null)),
    [media.characterId],
  );
  const set = useLiveQuery(
    () => (media.setId ? db.sets.get(media.setId) : Promise.resolve(null)),
    [media.setId],
  );
  const ui = useUI();
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-2 text-white/40">
        <span className="w-16">Cosplayer</span>
        <button
          className="text-white/80 hover:text-white truncate"
          onClick={() =>
            cosplayer && ui.navigate("characters", { cosplayerId: cosplayer.id }, cosplayer.name)
          }
        >
          {cosplayer?.name ?? "—"}
        </button>
      </div>
      <div className="flex items-center gap-2 text-white/40">
        <span className="w-16">Character</span>
        <button
          className="text-white/80 hover:text-white truncate"
          onClick={() =>
            character && ui.navigate("sets", { characterId: character.id }, character.name)
          }
        >
          {character?.name ?? "—"}
        </button>
      </div>
      <div className="flex items-center gap-2 text-white/40">
        <span className="w-16">Set</span>
        <button
          className="text-white/80 hover:text-white truncate"
          onClick={() => set && ui.navigate("sets", { setId: set.id }, set.name)}
        >
          {set?.name ?? "—"}
        </button>
      </div>
    </div>
  );
}

function TagEditor({ media }: { media: Media }) {
  const allTags = useLiveQuery(() => db.tags.toArray()) ?? [];
  const [input, setInput] = useState("");
  function addTag(name: string) {
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!media.tags.includes(existing.id)) {
        db.media.update(media.id, { tags: [...media.tags, existing.id] });
      }
    } else {
      // create
      const id = `tag_${Math.random().toString(36).slice(2, 10)}`;
      db.tags.put({ id, name, createdAt: Date.now() });
      db.media.update(media.id, { tags: [...media.tags, id] });
    }
  }
  function removeTag(id: string) {
    db.media.update(media.id, { tags: media.tags.filter((t) => t !== id) });
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {media.tags.map((tid) => {
          const t = allTags.find((x) => x.id === tid);
          if (!t) return null;
          return (
            <button
              key={tid}
              onClick={() => removeTag(t.id)}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[11px]"
              style={{ color: t.color }}
            >
              {t.name}
              <X className="h-2.5 w-2.5" />
            </button>
          );
        })}
        {media.tags.length === 0 && (
          <span className="text-xs text-white/40">No tags yet</span>
        )}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) {
            addTag(input.trim());
            setInput("");
          }
        }}
        placeholder="Type tag + Enter"
        className="w-full rounded bg-white/5 px-2 py-1 text-xs outline-none focus:bg-white/10"
      />
    </div>
  );
}
