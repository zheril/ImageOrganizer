"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Cosplayer } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { useConfig } from "@/lib/store/config";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { Users, Plus, Search, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { formatNumber } from "@/lib/format";

export function CosplayersView() {
  const { navigate, params } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAlias, setNewAlias] = useState("");

  const cosplayers = useLiveQuery(async () => {
    let arr = await db.cosplayers.orderBy("name").toArray();
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((c) => c.name.toLowerCase().includes(s) || c.alias?.toLowerCase().includes(s));
    }
    return arr;
  }, [q]) ?? [];

  // For each cosplayer, get char count and media count
  const counts = useLiveQuery(async () => {
    const allChars = await db.characters.toArray();
    const allMedia = await db.media.toArray();
    const m: Record<string, { chars: number; media: number }> = {};
    for (const c of cosplayers) {
      m[c.id] = {
        chars: allChars.filter((ch) => ch.cosplayerId === c.id).length,
        media: allMedia.filter((md) => md.cosplayerId === c.id).length,
      };
    }
    return m;
  }, [cosplayers]) ?? {};

  async function createCosplayer() {
    if (!newName.trim()) return;
    const id = `cosp_${Math.random().toString(36).slice(2, 10)}`;
    await db.cosplayers.put({
      id,
      name: newName.trim(),
      alias: newAlias.trim() || undefined,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setNewName("");
    setNewAlias("");
    setShowCreate(false);
    navigate("characters", { cosplayerId: id }, newName.trim());
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative w-72 max-w-[40vw]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${labels.cosplayerPlural.toLowerCase()}…`}
            className="pl-8 h-9"
          />
        </div>
        <Button onClick={() => setShowCreate((s) => !s)} size="sm" className="ml-auto gap-1">
          <Plus className="h-3.5 w-3.5" /> New {labels.cosplayer}
        </Button>
      </div>

      {showCreate && (
        <div className="mx-4 mb-4 rounded-lg border bg-card p-4 grid grid-cols-3 gap-3 items-end">
          <div className="col-span-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Hoshino Yuki" />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-muted-foreground">Alias</label>
            <Input value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="e.g. 星野雪" />
          </div>
          <div className="col-span-1 flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={createCosplayer}>Create</Button>
          </div>
        </div>
      )}

      <div className="px-4 pb-12">
        {cosplayers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {cosplayers.map((c) => (
              <CosplayerCard
                key={c.id}
                c={c}
                chars={counts[c.id]?.chars ?? 0}
                media={counts[c.id]?.media ?? 0}
                onClick={() => navigate("characters", { cosplayerId: c.id }, c.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CosplayerCard({ c, chars, media, onClick }: { c: Cosplayer; chars: number; media: number; onClick: () => void }) {
  const { openEditDialog } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  return (
    <div className="group relative text-left rounded-xl overflow-hidden border bg-card hover:shadow-md transition-all">
      <button
        onClick={onClick}
        className="block w-full text-left"
      >
        <div className="aspect-[3/4] relative bg-muted/30 overflow-hidden">
          {c.coverMediaId ? (
            <CoverThumb mediaId={c.coverMediaId} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <Users className="h-8 w-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-80" />
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <p className="font-semibold text-sm truncate">{c.name}</p>
            {c.alias && <p className="text-[11px] text-white/70 truncate">{c.alias}</p>}
          </div>
        </div>
        <div className="px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{chars} {labels.characterPlural.toLowerCase()}</span>
          <span className="tabular-nums">{formatNumber(media)} media</span>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); openEditDialog("cosplayer", c.id); }}
        className="absolute top-2 right-2 z-10 grid place-items-center h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
        aria-label="Edit cosplayer"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CoverThumb({ mediaId }: { mediaId: string }) {
  const media = useLiveQuery(() => db.media.get(mediaId), [mediaId]);
  if (!media) return null;
  // `key={media.id}` is critical — without it the cached thumb URL persists
  // when the cover media changes and the old image keeps showing.
  return <MediaThumbnail key={media.id} media={media} size="medium" className="w-full h-full" />;
}

function EmptyState() {
  const labels = useConfig((s) => s.fieldLabels);
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="rounded-full bg-muted/40 p-4 mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">No {labels.cosplayerPlural.toLowerCase()} yet</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Create your first one with “New {labels.cosplayer}”.</p>
    </div>
  );
}
