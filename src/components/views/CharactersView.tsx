"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Character } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { useConfig } from "@/lib/store/config";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { Drama, ChevronRight, Plus, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { formatNumber } from "@/lib/format";

export function CharactersView() {
  const { params, navigate } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  const cosplayerId = params.cosplayerId;
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFranchise, setNewFranchise] = useState("");

  const cosplayer = useLiveQuery(
    () => (cosplayerId ? db.cosplayers.get(cosplayerId) : Promise.resolve(null)),
    [cosplayerId],
  );

  const characters = useLiveQuery(async () => {
    let arr = cosplayerId
      ? await db.characters.where("cosplayerId").equals(cosplayerId).toArray()
      : await db.characters.toArray();
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((c) => c.name.toLowerCase().includes(s) || c.franchise?.toLowerCase().includes(s));
    }
    // Sort by franchise then name
    arr.sort((a, b) => (a.franchise || "").localeCompare(b.franchise || "") || a.name.localeCompare(b.name));
    return arr;
  }, [cosplayerId, q]) ?? [];

  // Set + media counts
  const counts = useLiveQuery(async () => {
    const allSets = await db.sets.toArray();
    const allMedia = await db.media.toArray();
    const m: Record<string, { sets: number; media: number }> = {};
    for (const c of characters) {
      m[c.id] = {
        sets: allSets.filter((s) => s.characterId === c.id).length,
        media: allMedia.filter((md) => md.characterId === c.id).length,
      };
    }
    return m;
  }, [characters]) ?? {};

  async function createCharacter() {
    if (!cosplayerId || !newName.trim()) return;
    const id = `char_${Math.random().toString(36).slice(2, 10)}`;
    await db.characters.put({
      id,
      cosplayerId,
      name: newName.trim(),
      franchise: newFranchise.trim() || undefined,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setNewName("");
    setNewFranchise("");
    setShowCreate(false);
    navigate("sets", { characterId: id }, newName.trim());
  }

  // Group by franchise for nicer display
  const grouped: Record<string, Character[]> = {};
  for (const c of characters) {
    const key = c.franchise || "—";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center gap-2 px-4 py-3">
        {cosplayer && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate("cosplayers")} className="hover:text-foreground">
              Cosplayers
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{cosplayer.name}</span>
            <button
              onClick={() => useUI.getState().openEditDialog("cosplayer", cosplayer.id)}
              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border hover:bg-muted/50"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${labels.characterPlural.toLowerCase()}…`}
          className="ml-auto w-72 max-w-[40vw] h-9"
        />
        {cosplayerId && (
          <Button size="sm" className="gap-1" onClick={() => setShowCreate((s) => !s)}>
            <Plus className="h-3.5 w-3.5" /> New {labels.character}
          </Button>
        )}
      </div>

      {showCreate && cosplayer && (
        <div className="mx-4 mb-4 rounded-lg border bg-card p-4 grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Character name</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 2B" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Franchise</label>
            <Input value={newFranchise} onChange={(e) => setNewFranchise(e.target.value)} placeholder="e.g. NieR:Automata" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={createCharacter}>Create</Button>
          </div>
        </div>
      )}

      <div className="px-4 pb-12 space-y-8">
        {Object.entries(grouped).map(([franchise, chars]) => (
          <div key={franchise}>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-semibold">{franchise}</h2>
              <span className="text-xs text-muted-foreground">{chars.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {chars.map((c) => (
                <CharacterCard
                  key={c.id}
                  c={c}
                  sets={counts[c.id]?.sets ?? 0}
                  media={counts[c.id]?.media ?? 0}
                  onClick={() => navigate("sets", { characterId: c.id }, c.name)}
                />
              ))}
            </div>
          </div>
        ))}
        {characters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="rounded-full bg-muted/40 p-4 mb-4">
              <Drama className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No {labels.characterPlural.toLowerCase()} yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ c, sets, media, onClick }: { c: Character; sets: number; media: number; onClick: () => void }) {
  const { openEditDialog } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  return (
    <div className="group relative text-left rounded-lg overflow-hidden border bg-card hover:shadow-md transition-all">
      <button onClick={onClick} className="block w-full text-left">
        <div className="aspect-square relative bg-muted/30 overflow-hidden">
          {c.coverMediaId ? (
            <CoverThumb mediaId={c.coverMediaId} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <Drama className="h-6 w-6" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-80" />
          <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
            <p className="font-medium text-xs truncate">{c.name}</p>
          </div>
        </div>
        <div className="px-2 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{sets} {labels.setPlural.toLowerCase()}</span>
          <span className="tabular-nums">{formatNumber(media)}</span>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); openEditDialog("character", c.id); }}
        className="absolute top-1.5 right-1.5 z-10 grid place-items-center h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
        aria-label="Edit character"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

function CoverThumb({ mediaId }: { mediaId: string }) {
  const media = useLiveQuery(() => db.media.get(mediaId), [mediaId]);
  if (!media) return null;
  return <MediaThumbnail key={media.id} media={media} size="medium" className="w-full h-full" />;
}
