"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Media, type Cosplayer, type Character, type Set as SetType } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { useConfig } from "@/lib/store/config";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
// DialogHeader/DialogTitle/DialogDescription are imported and used at the top-level EditDialog
// so they appear here for reference even though some are only used in the parent.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { Check, Trash2, Image as ImageIcon, Wand2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditDialog() {
  const { editDialog, closeEditDialog } = useUI();
  const labels = useConfig((s) => s.fieldLabels);
  if (!editDialog.open || !editDialog.type || !editDialog.id) return null;

  const titles: Record<string, string> = {
    cosplayer: `Edit ${labels.cosplayer}`,
    character: `Edit ${labels.character}`,
    set: `Edit ${labels.set}`,
  };
  const descriptions: Record<string, string> = {
    cosplayer: `Update details, pick a cover image, or remove this ${labels.cosplayer.toLowerCase()} from the library.`,
    character: `Update name, franchise, or pick a cover image.`,
    set: `Update ${labels.set.toLowerCase()} metadata, pick a cover image, or remove this ${labels.set.toLowerCase()}.`,
  };
  const title = titles[editDialog.type];
  const description = descriptions[editDialog.type];

  return (
    <Dialog open={editDialog.open} onOpenChange={(o) => !o && closeEditDialog()}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Always render DialogTitle + DialogDescription at the top level so Radix's
            accessibility check passes even while the form body is still loading its record. */}
        <DialogHeader className="p-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {editDialog.type === "cosplayer" && <CosplayerEditForm id={editDialog.id} />}
          {editDialog.type === "character" && <CharacterEditForm id={editDialog.id} />}
          {editDialog.type === "set" && <SetEditForm id={editDialog.id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Loading() {
  return (
    <div className="grid place-items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function CosplayerEditForm({ id }: { id: string }) {
  const record = useLiveQuery(() => db.cosplayers.get(id), [id]);
  if (!record) return <Loading />;
  return <CosplayerEditFormInner key={record.id} record={record} />;
}

function CosplayerEditFormInner({ record }: { record: Cosplayer }) {
  const { closeEditDialog } = useUI();
  const [name, setName] = useState(record.name);
  const [alias, setAlias] = useState(record.alias || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [social, setSocial] = useState((record.socialLinks || []).join("\n"));
  const [coverId, setCoverId] = useState<string | undefined>(record.coverMediaId);
  const [tab, setTab] = useState("details");

  const coverCandidates = useLiveQuery(async () => {
    const arr = await db.media.where("cosplayerId").equals(record.id).toArray();
    return arr.slice(0, 200);
  }, [record.id]) ?? [];

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    await db.cosplayers.update(record.id, {
      name: name.trim(),
      alias: alias.trim() || undefined,
      notes: notes.trim() || undefined,
      socialLinks: social.split("\n").map((s) => s.trim()).filter(Boolean),
      coverMediaId: coverId,
      updatedAt: Date.now(),
    });
    toast.success("Cosplayer updated");
    closeEditDialog();
  }

  async function del() {
    if (!confirm(
      `Delete cosplayer "${record.name}"?\n\n` +
      `This will also delete all their characters, sets, and remove ${coverCandidates.length} media from the library.\n` +
      `Original files on disk are NOT touched.`,
    )) return;
    const chars = await db.characters.where("cosplayerId").equals(record.id).toArray();
    const sets = await db.sets.where("cosplayerId").equals(record.id).toArray();
    const allMedia = await db.media.where("cosplayerId").equals(record.id).toArray();
    await db.media.bulkDelete(allMedia.map((m) => m.id));
    await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.characters.bulkDelete(chars.map((c) => c.id));
    await db.cosplayers.delete(record.id);
    toast.success("Cosplayer deleted");
    closeEditDialog();
    useUI.getState().navigate("cosplayers");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 self-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="cover">Cover image</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex-1 min-h-0 overflow-y-auto p-6 pt-3 m-0">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hoshino Yuki" />
            </div>
            <div>
              <Label htmlFor="alias">Alias / nickname</Label>
              <Input id="alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. 星野雪" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Background, specialties, etc."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="social">Social links (one per line)</Label>
              <Textarea
                id="social"
                value={social}
                onChange={(e) => setSocial(e.target.value)}
                placeholder={"https://twitter.com/...\nhttps://instagram.com/..."}
                rows={3}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="cover" className="flex-1 min-h-0 overflow-y-auto p-6 pt-3 m-0">
          <CoverPicker
            candidates={coverCandidates}
            selectedId={coverId}
            onSelect={setCoverId}
            emptyHint="No media in this cosplayer yet. Add some via a watched folder first."
          />
        </TabsContent>
      </Tabs>
      <DialogFooter className="p-4 border-t flex items-center justify-between gap-2 shrink-0">
        <Button variant="destructive" size="sm" className="gap-1" onClick={del}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => closeEditDialog()}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </DialogFooter>
    </div>
  );
}

function CharacterEditForm({ id }: { id: string }) {
  const record = useLiveQuery(() => db.characters.get(id), [id]);
  if (!record) return <Loading />;
  return <CharacterEditFormInner key={record.id} record={record} />;
}

function CharacterEditFormInner({ record }: { record: Character }) {
  const { closeEditDialog } = useUI();
  const [name, setName] = useState(record.name);
  const [franchise, setFranchise] = useState(record.franchise || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [coverId, setCoverId] = useState<string | undefined>(record.coverMediaId);
  const [tab, setTab] = useState("details");

  const coverCandidates = useLiveQuery(async () => {
    const arr = await db.media.where("characterId").equals(record.id).toArray();
    return arr.slice(0, 200);
  }, [record.id]) ?? [];

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    await db.characters.update(record.id, {
      name: name.trim(),
      franchise: franchise.trim() || undefined,
      notes: notes.trim() || undefined,
      coverMediaId: coverId,
      updatedAt: Date.now(),
    });
    toast.success("Character updated");
    closeEditDialog();
  }

  async function del() {
    if (!confirm(
      `Delete character "${record.name}"?\n\n` +
      `This will also delete all their sets and remove ${coverCandidates.length} media from the library.\n` +
      `Original files on disk are NOT touched.`,
    )) return;
    const sets = await db.sets.where("characterId").equals(record.id).toArray();
    const allMedia = await db.media.where("characterId").equals(record.id).toArray();
    await db.media.bulkDelete(allMedia.map((m) => m.id));
    await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.characters.delete(record.id);
    toast.success("Character deleted");
    closeEditDialog();
    useUI.getState().navigate("cosplayers");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 self-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="cover">Cover image</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex-1 min-h-0 overflow-y-auto p-6 pt-3 m-0">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Character name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2B" />
            </div>
            <div>
              <Label htmlFor="franchise">Franchise / source</Label>
              <Input id="franchise" value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. NieR:Automata" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Variants, version notes, etc." />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="cover" className="flex-1 min-h-0 overflow-y-auto p-6 pt-3 m-0">
          <CoverPicker
            candidates={coverCandidates}
            selectedId={coverId}
            onSelect={setCoverId}
            emptyHint="No media for this character yet."
          />
        </TabsContent>
      </Tabs>
      <DialogFooter className="p-4 border-t flex items-center justify-between gap-2 shrink-0">
        <Button variant="destructive" size="sm" className="gap-1" onClick={del}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => closeEditDialog()}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </DialogFooter>
    </div>
  );
}

function SetEditForm({ id }: { id: string }) {
  const record = useLiveQuery(() => db.sets.get(id), [id]);
  if (!record) return <Loading />;
  return <SetEditFormInner key={record.id} record={record} />;
}

function SetEditFormInner({ record }: { record: SetType }) {
  const { closeEditDialog } = useUI();
  const [name, setName] = useState(record.name);
  const [date, setDate] = useState(record.date || "");
  const [location, setLocation] = useState(record.location || "");
  const [event, setEvent] = useState(record.event || "");
  const [photographer, setPhotographer] = useState(record.photographer || "");
  const [camera, setCamera] = useState(record.camera || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [description, setDescription] = useState(record.description || "");
  const [coverId, setCoverId] = useState<string | undefined>(record.coverMediaId);
  const [tab, setTab] = useState("details");

  const coverCandidates = useLiveQuery(async () => {
    const arr = await db.media.where("setId").equals(record.id).toArray();
    return arr.slice(0, 200);
  }, [record.id]) ?? [];

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    await db.sets.update(record.id, {
      name: name.trim(),
      date: date || undefined,
      location: location || undefined,
      event: event || undefined,
      photographer: photographer || undefined,
      camera: camera || undefined,
      notes: notes || undefined,
      description: description || undefined,
      coverMediaId: coverId,
      updatedAt: Date.now(),
    });
    toast.success("Set updated");
    closeEditDialog();
  }

  async function del() {
    if (!confirm(
      `Delete set "${record.name}"?\n\n` +
      `This will remove ${coverCandidates.length} media from the library.\n` +
      `Original files on disk are NOT touched.`,
    )) return;
    await db.media.bulkDelete(coverCandidates.map((m) => m.id));
    await db.sets.delete(record.id);
    toast.success("Set deleted");
    closeEditDialog();
    useUI.getState().navigate("sets");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 self-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="cover">Cover image</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex-1 min-h-0 overflow-y-auto p-6 pt-3 m-0">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Set name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anime Expo 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. LA Convention Center" />
              </div>
              <div>
                <Label htmlFor="event">Event</Label>
                <Input id="event" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="e.g. Anime Expo 2026" />
              </div>
              <div>
                <Label htmlFor="photographer">Photographer</Label>
                <Input id="photographer" value={photographer} onChange={(e) => setPhotographer(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="camera">Camera</Label>
                <Input id="camera" value={camera} onChange={(e) => setCamera(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short description of this set" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes" />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="cover" className="flex-1 min-h-0 overflow-y-auto p-6 pt-3 m-0">
          <CoverPicker
            candidates={coverCandidates}
            selectedId={coverId}
            onSelect={setCoverId}
            emptyHint="No media in this set yet."
          />
        </TabsContent>
      </Tabs>
      <DialogFooter className="p-4 border-t flex items-center justify-between gap-2 shrink-0">
        <Button variant="destructive" size="sm" className="gap-1" onClick={del}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => closeEditDialog()}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </DialogFooter>
    </div>
  );
}

// Reusable cover picker
export function CoverPicker({
  candidates,
  selectedId,
  onSelect,
  emptyHint,
}: {
  candidates: Media[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  emptyHint?: string;
}) {
  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        {emptyHint || "No media available"}
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Pick any media in this hierarchy as the cover image.
        </p>
        {selectedId && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSelect(undefined)}>
            Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {candidates.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id === selectedId ? undefined : m.id)}
            className={cn(
              "relative aspect-square rounded-md overflow-hidden border-2 transition",
              selectedId === m.id ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-foreground/20",
            )}
          >
            <MediaThumbnail media={m} size="tiny" className="w-full h-full" />
            {selectedId === m.id && (
              <div className="absolute inset-0 bg-primary/30 grid place-items-center">
                <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
