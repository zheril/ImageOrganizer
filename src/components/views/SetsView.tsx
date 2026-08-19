"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Set as SetType } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { useConfig } from "@/lib/store/config";
import { MediaGrid } from "@/components/media/MediaGrid";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { FolderClosed, ChevronRight, Plus, Calendar, MapPin, Camera, User, Info, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

export function SetsView() {
  const { params, navigate } = useUI();
  const characterId = params.characterId;
  const setId = params.setId;

  if (setId) return <SetDetail setId={setId} />;
  return <SetsList characterId={characterId} />;
}

function SetsList({ characterId }: { characterId?: string }) {
  const { navigate } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const character = useLiveQuery(
    () => (characterId ? db.characters.get(characterId) : Promise.resolve(null)),
    [characterId],
  );
  const cosplayer = useLiveQuery(async () => {
    if (!character?.cosplayerId) return null;
    return db.cosplayers.get(character.cosplayerId);
  }, [character]);

  const sets = useLiveQuery(async () => {
    let arr = characterId
      ? await db.sets.where("characterId").equals(characterId).toArray()
      : await db.sets.toArray();
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((st) => st.name.toLowerCase().includes(s) || st.event?.toLowerCase().includes(s) || st.location?.toLowerCase().includes(s));
    }
    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return arr;
  }, [characterId, q]) ?? [];

  const mediaCounts = useLiveQuery(async () => {
    const all = await db.media.toArray();
    const m: Record<string, number> = {};
    for (const s of sets) {
      m[s.id] = all.filter((md) => md.setId === s.id).length;
    }
    return m;
  }, [sets]) ?? {};

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center gap-2 px-4 py-3">
        {character && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button onClick={() => navigate("cosplayers")} className="hover:text-foreground">Cosplayers</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <button onClick={() => character.cosplayerId && navigate("characters", { cosplayerId: character.cosplayerId }, cosplayer?.name || "Cosplayer")} className="hover:text-foreground">
              {cosplayer?.name || "—"}
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{character.name}</span>
          </div>
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${labels.setPlural.toLowerCase()}…`}
          className="ml-auto w-72 max-w-[40vw] h-9"
        />
        <Button
          onClick={() => setShowCreate((s) => !s)}
          size="sm"
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> New {labels.set}
        </Button>
      </div>

      {showCreate && (
        <NewSetForm
          characterId={characterId}
          cosplayerId={character?.cosplayerId}
          onCreated={(setId, setName) => {
            setShowCreate(false);
            navigate("sets", { setId }, setName);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="px-4 pb-12">
        {sets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="rounded-full bg-muted/40 p-4 mb-4">
              <FolderClosed className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No {labels.setPlural.toLowerCase()} yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {character
                ? `Click \"New ${labels.set}\" above to create one for this ${labels.character.toLowerCase()}.`
                : `Pick a ${labels.cosplayer.toLowerCase()} → ${labels.character.toLowerCase()}, then create a ${labels.set.toLowerCase()}, or use the Inbox → Assign workflow.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sets.map((s) => (
              <SetCard
                key={s.id}
                set={s}
                mediaCount={mediaCounts[s.id] ?? 0}
                onClick={() => navigate("sets", { setId: s.id }, s.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline form for creating a new set. If a character is already selected,
// only the set's own fields are shown. Otherwise, also pick cosplayer + character.
function NewSetForm({
  characterId,
  cosplayerId,
  onCreated,
  onCancel,
}: {
  characterId?: string;
  cosplayerId?: string;
  onCreated: (setId: string, setName: string) => void;
  onCancel: () => void;
}) {
  const allCosplayers = useLiveQuery(() => db.cosplayers.orderBy("name").toArray()) ?? [];
  const [pickCosplayerId, setPickCosplayerId] = useState(cosplayerId || "");
  const [pickCharacterId, setPickCharacterId] = useState(characterId || "");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [event, setEvent] = useState("");
  const [photographer, setPhotographer] = useState("");

  const characters = useLiveQuery(
    async () => (pickCosplayerId ? db.characters.where("cosplayerId").equals(pickCosplayerId).toArray() : []),
    [pickCosplayerId],
  ) ?? [];

  async function create() {
    const finalCosplayerId = cosplayerId || pickCosplayerId;
    const finalCharacterId = characterId || pickCharacterId;
    if (!finalCosplayerId) {
      toast.error("Pick a cosplayer first");
      return;
    }
    if (!finalCharacterId) {
      toast.error("Pick a character first");
      return;
    }
    if (!name.trim()) {
      toast.error("Set name is required");
      return;
    }
    const id = `set_${Math.random().toString(36).slice(2, 10)}`;
    await db.sets.put({
      id,
      characterId: finalCharacterId,
      cosplayerId: finalCosplayerId,
      name: name.trim(),
      date: date || undefined,
      location: location || undefined,
      event: event || undefined,
      photographer: photographer || undefined,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    toast.success(`Created set "${name.trim()}"`);
    onCreated(id, name.trim());
  }

  return (
    <div className="mx-4 mb-4 rounded-lg border bg-card p-4 space-y-3">
      {/* Pick cosplayer + character if not already chosen */}
      {!characterId && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Cosplayer</Label>
            <Select value={pickCosplayerId} onValueChange={(v) => { setPickCosplayerId(v); setPickCharacterId(""); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pick cosplayer" />
              </SelectTrigger>
              <SelectContent>
                {allCosplayers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Character</Label>
            <Select value={pickCharacterId} onValueChange={setPickCharacterId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={pickCosplayerId ? "Pick character" : "Pick cosplayer first"} />
              </SelectTrigger>
              <SelectContent>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.franchise ? ` (${c.franchise})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {characterId && characterId && (
        <p className="text-xs text-muted-foreground">
          Creating set under the current character.
        </p>
      )}
      <div>
        <Label htmlFor="newset-name">Set name *</Label>
        <Input
          id="newset-name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="e.g. Studio Shoot 01"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="newset-date">Date</Label>
          <Input id="newset-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="newset-loc">Location</Label>
          <Input id="newset-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. LA Convention Center" />
        </div>
        <div>
          <Label htmlFor="newset-event">Event</Label>
          <Input id="newset-event" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="e.g. Anime Expo 2026" />
        </div>
        <div>
          <Label htmlFor="newset-ph">Photographer</Label>
          <Input id="newset-ph" value={photographer} onChange={(e) => setPhotographer(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={create}>Create set</Button>
      </div>
    </div>
  );
}

function SetCard({ set, mediaCount, onClick }: { set: SetType; mediaCount: number; onClick: () => void }) {
  const labels = useConfig((s) => s.fieldLabels);
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl overflow-hidden border bg-card hover:shadow-md transition-all flex"
    >
      <div className="w-32 h-32 shrink-0 relative bg-muted/30 overflow-hidden">
        {set.coverMediaId ? (
          <CoverThumb mediaId={set.coverMediaId} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <FolderClosed className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="flex-1 p-3 min-w-0">
        <p className="font-medium text-sm truncate">{set.name}</p>
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {set.date && <Meta icon={Calendar}>{set.date}</Meta>}
          {set.location && <Meta icon={MapPin}>{set.location}</Meta>}
          {set.event && <Meta icon={Info}>{set.event}</Meta>}
          {set.photographer && <Meta icon={Camera}>{set.photographer}</Meta>}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">{mediaCount} {labels.set === labels.setPlural ? "items" : "media"}</p>
      </div>
    </button>
  );
}

function Meta({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 truncate">
      <Icon className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function SetDetail({ setId }: { setId: string }) {
  const { navigate, openEditDialog } = useUI();
  const [busy, setBusy] = useState(false);
  const set = useLiveQuery(() => db.sets.get(setId), [setId]);
  const character = useLiveQuery(
    () => (set?.characterId ? db.characters.get(set.characterId) : Promise.resolve(null)),
    [set?.characterId],
  );
  const cosplayer = useLiveQuery(
    () => (set?.cosplayerId ? db.cosplayers.get(set.cosplayerId) : Promise.resolve(null)),
    [set?.cosplayerId],
  );

  if (!set) {
    return (
      <div className="p-8 text-center text-muted-foreground">Set not found.</div>
    );
  }

  async function addFilesToSet() {
    setBusy(true);
    try {
      const { pickFiles, supportsFilePicker } = await import("@/lib/fs");
      let picked: { fileHandle: any; file: File }[] | null = null;
      if (supportsFilePicker()) {
        picked = await pickFiles();
      }
      if (!picked) {
        // Fallback: file input
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = "image/*,video/*";
        const files: File[] = await new Promise((resolve) => {
          input.onchange = () => resolve(Array.from(input.files || []));
          input.click();
        });
        if (files.length === 0) {
          setBusy(false);
          return;
        }
        picked = files.map((f) => ({ fileHandle: undefined, file: f }));
      }
      if (!picked || picked.length === 0) {
        setBusy(false);
        return;
      }
      const { db, uid, computeThumbKey } = await import("@/lib/db/dexie");
      let added = 0;
      for (const { fileHandle, file } of picked) {
        const lower = file.name.toLowerCase();
        const isImage = /\.(jpg|jpeg|png|webp|gif|bmp|avif)$/i.test(lower);
        const isVideo = /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(lower);
        if (!isImage && !isVideo) continue;
        const id = uid("med");
        // For file-picker files we have a handle and can persist; for input files we don't (transient)
        // For transient files, we still create a blob URL but warn the user they won't survive reload
        const sourceUrl = fileHandle ? file.name : URL.createObjectURL(file);
        const thumbKey = await computeThumbKey({
          sourceUrl: sourceUrl,
          fileSize: file.size,
          fileModified: Math.floor(file.lastModified / 1000),
        });
        await db.media.put({
          id,
          cosplayerId: set!.cosplayerId,
          characterId: set!.characterId,
          setId: set!.id,
          filename: file.name,
          sourceUrl,
          fileHandle,
          fileSize: file.size,
          mimeType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
          kind: isVideo ? "video" : "image",
          rating: 0,
          favorite: false,
          tags: [],
          importedAt: Date.now(),
          fileCreated: Math.floor(file.lastModified / 1000),
          fileModified: Math.floor(file.lastModified / 1000),
          thumbKey,
        });
        added++;
      }
      const { toast } = await import("sonner");
      if (added > 0) {
        toast.success(`Added ${added} file${added === 1 ? "" : "s"} to "${set!.name}"`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/20">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <button onClick={() => navigate("cosplayers")} className="hover:text-foreground">Cosplayers</button>
          {cosplayer && (
            <>
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => cosplayer.id && navigate("characters", { cosplayerId: cosplayer.id }, cosplayer.name)}
                className="hover:text-foreground"
              >
                {cosplayer.name}
              </button>
              <button
                onClick={() => openEditDialog("cosplayer", cosplayer.id)}
                className="ml-0.5 text-[10px] text-muted-foreground/70 hover:text-foreground"
                aria-label="Edit cosplayer"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </>
          )}
          {character && (
            <>
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => character.cosplayerId && navigate("sets", { characterId: character.id }, character.name)}
                className="hover:text-foreground"
              >
                {character.name}
              </button>
              <button
                onClick={() => openEditDialog("character", character.id)}
                className="ml-0.5 text-[10px] text-muted-foreground/70 hover:text-foreground"
                aria-label="Edit character"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{set.name}</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{set.name}</h1>
            {character && cosplayer && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {character.name}{character.franchise ? ` · ${character.franchise}` : ""} · {cosplayer.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={busy}
              onClick={addFilesToSet}
            >
              <Plus className="h-3.5 w-3.5" /> Add files to this set
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => openEditDialog("set", set.id)}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </div>
        {/* Metadata chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {set.date && <Chip icon={Calendar}>{set.date}</Chip>}
          {set.location && <Chip icon={MapPin}>{set.location}</Chip>}
          {set.event && <Chip icon={Info}>{set.event}</Chip>}
          {set.photographer && <Chip icon={Camera}>{set.photographer}</Chip>}
          {set.camera && <Chip icon={Camera}>{set.camera}</Chip>}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0">
        <MediaGrid query={{ setId }} />
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

function CoverThumb({ mediaId }: { mediaId: string }) {
  const media = useLiveQuery(() => db.media.get(mediaId), [mediaId]);
  if (!media) return null;
  return <MediaThumbnail key={media.id} media={media} size="medium" className="w-full h-full" />;
}
