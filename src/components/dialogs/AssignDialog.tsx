"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, uid, type Cosplayer, type Character, type Set } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronRight, Plus, Check, Sparkles } from "lucide-react";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { toast } from "sonner";

import { useConfig } from "@/lib/store/config";

export function AssignDialog() {
  const { assignDialogOpen, assignDialogIds, closeAssignDialog } = useUI();
  const labels = useConfig((s) => s.fieldLabels);

  const [cosplayerId, setCosplayerId] = useState<string>("");
  const [newCosplayerName, setNewCosplayerName] = useState("");

  const [characterId, setCharacterId] = useState<string>("");
  const [newCharName, setNewCharName] = useState("");

  const [setId, setSetId] = useState<string>("");
  const [newSetName, setNewSetName] = useState("");

  const cosplayers = useLiveQuery(() => db.cosplayers.orderBy("name").toArray()) ?? [];
  const characters = useLiveQuery(
    async () => (cosplayerId ? db.characters.where("cosplayerId").equals(cosplayerId).toArray() : []),
    [cosplayerId],
  ) ?? [];
  const sets = useLiveQuery(
    async () => (characterId ? db.sets.where("characterId").equals(characterId).toArray() : []),
    [characterId],
  ) ?? [];

  const mediaItems = useLiveQuery(async () => {
    if (assignDialogIds.length === 0) return [];
    return db.media.bulkGet(assignDialogIds);
  }, [assignDialogIds]) ?? [];

  useEffect(() => {
    if (assignDialogOpen) {
      setCosplayerId("");
      setNewCosplayerName("");
      setCharacterId("");
      setNewCharName("");
      setSetId("");
      setNewSetName("");
    }
  }, [assignDialogOpen]);

  const count = assignDialogIds.length;

  async function handleAssign() {
    let finalCosId = cosplayerId;
    if (!finalCosId) {
      if (!newCosplayerName.trim()) {
        toast.error(`Please pick or type a ${labels.cosplayer || "Artist"} name`);
        return;
      }
      finalCosId = uid("cosp");
      await db.cosplayers.put({
        id: finalCosId,
        name: newCosplayerName.trim(),
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    let finalCharId = characterId;
    if (!finalCharId) {
      if (!newCharName.trim()) {
        toast.error(`Please pick or type a ${labels.character || "Subject"} name`);
        return;
      }
      finalCharId = uid("char");
      await db.characters.put({
        id: finalCharId,
        cosplayerId: finalCosId,
        name: newCharName.trim(),
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    let finalSetId = setId;
    if (!finalSetId) {
      if (!newSetName.trim()) {
        toast.error(`Please pick or type an ${labels.set || "Album"} name`);
        return;
      }
      finalSetId = uid("set");
      await db.sets.put({
        id: finalSetId,
        characterId: finalCharId,
        cosplayerId: finalCosId,
        name: newSetName.trim(),
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await commitAssignmentWithIds(finalCosId, finalCharId, finalSetId);
    closeAssignDialog();
  }

  async function commitAssignmentWithIds(c: string, ch: string, s: string) {
    let ok = true;
    for (const id of assignDialogIds) {
      try {
        await db.media.update(id, { cosplayerId: c, characterId: ch, setId: s });
      } catch (e) {
        console.error("Failed to assign", id, e);
        ok = false;
      }
    }
    if (ok) {
      toast.success(`Assigned ${assignDialogIds.length} media to set`);
    } else {
      toast.error("Some media could not be assigned (see console)");
    }
    // Navigate to the assigned set so user sees the result
    const set = await db.sets.get(s);
    if (set) {
      useUI.getState().navigate("sets", { setId: s }, set.name);
    }
  }

  if (!assignDialogOpen) return null;

  return (
    <Dialog open={assignDialogOpen} onOpenChange={(o) => !o && closeAssignDialog()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-6">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Assign {count} Selected Media
          </DialogTitle>
          <DialogDescription>
            Quickly organize items into {labels.cosplayer || "Artist"} → {labels.character || "Subject"} → {labels.set || "Album"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto max-h-[65vh]">
          {/* Level 1 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. {labels.cosplayer || "Artist"}
            </Label>
            <div className="flex gap-2">
              <Select value={cosplayerId} onValueChange={(v) => { setCosplayerId(v); setCharacterId(""); setSetId(""); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Select existing ${labels.cosplayer || "Artist"}`} />
                </SelectTrigger>
                <SelectContent>
                  {cosplayers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={`Or type new ${labels.cosplayer || "Artist"}`}
                value={newCosplayerName}
                onChange={(e) => { setNewCosplayerName(e.target.value); if (e.target.value) setCosplayerId(""); }}
                className="flex-1"
              />
            </div>
          </div>

          {/* Level 2 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              2. {labels.character || "Subject"}
            </Label>
            <div className="flex gap-2">
              <Select
                value={characterId}
                disabled={!cosplayerId && !newCosplayerName}
                onValueChange={(v) => { setCharacterId(v); setSetId(""); }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Select existing ${labels.character || "Subject"}`} />
                </SelectTrigger>
                <SelectContent>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={`Or type new ${labels.character || "Subject"}`}
                value={newCharName}
                onChange={(e) => { setNewCharName(e.target.value); if (e.target.value) setCharacterId(""); }}
                className="flex-1"
              />
            </div>
          </div>

          {/* Level 3 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              3. {labels.set || "Album"}
            </Label>
            <div className="flex gap-2">
              <Select
                value={setId}
                disabled={!characterId && !newCharName}
                onValueChange={(v) => setSetId(v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Select existing ${labels.set || "Album"}`} />
                </SelectTrigger>
                <SelectContent>
                  {sets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={`Or type new ${labels.set || "Album"}`}
                value={newSetName}
                onChange={(e) => { setNewSetName(e.target.value); if (e.target.value) setSetId(""); }}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={closeAssignDialog}>Cancel</Button>
          <Button onClick={handleAssign}>Assign Media</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepChip({ children, active, done }: { children: React.ReactNode; active: boolean; done?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" :
        done ? "bg-primary/15 text-primary" :
        "bg-muted text-muted-foreground"
      }`}
    >
      {done && <Check className="h-3 w-3" />}
      {children}
    </span>
  );
}

// ---- Step components ----
function ModeToggle({ mode, setMode }: { mode: "pick" | "create"; setMode: (m: "pick" | "create") => void }) {
  return (
    <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-xs">
      <button
        onClick={() => setMode("pick")}
        className={`px-3 py-1.5 rounded ${mode === "pick" ? "bg-background shadow" : "text-muted-foreground"}`}
      >
        Pick existing
      </button>
      <button
        onClick={() => setMode("create")}
        className={`px-3 py-1.5 rounded ${mode === "create" ? "bg-background shadow" : "text-muted-foreground"}`}
      >
        Create new
      </button>
    </div>
  );
}

function StepActions({ onBack, onContinue, backLabel = "Back", continueLabel = "Continue" }: { onBack?: () => void; onContinue: () => void; backLabel?: string; continueLabel?: string }) {
  return (
    <div className="flex justify-between mt-6">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>{backLabel}</Button>
      ) : <div />}
      <Button onClick={onContinue}>{continueLabel}</Button>
    </div>
  );
}

function CosplayerStep(props: {
  cosplayers: Cosplayer[];
  cosplayerId: string;
  setCosplayerId: (id: string) => void;
  mode: "pick" | "create";
  setMode: (m: "pick" | "create") => void;
  newName: string;
  setNewName: (s: string) => void;
  newAlias: string;
  setNewAlias: (s: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <ModeToggle mode={props.mode} setMode={props.setMode} />

      {props.mode === "pick" ? (
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Cosplayer</Label>
          {props.cosplayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cosplayers yet — switch to "Create new".</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {props.cosplayers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => props.setCosplayerId(c.id)}
                  className={`w-full flex items-center justify-between rounded-md border p-2 text-left text-sm transition ${
                    props.cosplayerId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.alias && <p className="text-xs text-muted-foreground">{c.alias}</p>}
                  </div>
                  {props.cosplayerId === c.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="cos-name">Cosplayer name</Label>
            <Input id="cos-name" value={props.newName} onChange={(e) => props.setNewName(e.target.value)} placeholder="e.g. Hoshino Yuki" />
          </div>
          <div>
            <Label htmlFor="cos-alias">Alias (optional)</Label>
            <Input id="cos-alias" value={props.newAlias} onChange={(e) => props.setNewAlias(e.target.value)} placeholder="e.g. 星野雪" />
          </div>
        </div>
      )}

      <StepActions onContinue={props.onContinue} continueLabel="Continue → Character" />
    </div>
  );
}

function CharacterStep(props: {
  characters: Character[];
  characterId: string;
  setCharacterId: (id: string) => void;
  mode: "pick" | "create";
  setMode: (m: "pick" | "create") => void;
  newName: string;
  setNewName: (s: string) => void;
  newFranchise: string;
  setNewFranchise: (s: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <ModeToggle mode={props.mode} setMode={props.setMode} />
      {props.mode === "pick" ? (
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Character</Label>
          {props.characters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No characters for this cosplayer yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {props.characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => props.setCharacterId(c.id)}
                  className={`w-full flex items-center justify-between rounded-md border p-2 text-left text-sm transition ${
                    props.characterId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.franchise && <p className="text-xs text-muted-foreground">{c.franchise}</p>}
                  </div>
                  {props.characterId === c.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="ch-name">Character name</Label>
            <Input id="ch-name" value={props.newName} onChange={(e) => props.setNewName(e.target.value)} placeholder="e.g. 2B" />
          </div>
          <div>
            <Label htmlFor="ch-franchise">Franchise / Source</Label>
            <Input id="ch-franchise" value={props.newFranchise} onChange={(e) => props.setNewFranchise(e.target.value)} placeholder="e.g. NieR:Automata" />
          </div>
        </div>
      )}

      <StepActions onBack={props.onBack} onContinue={props.onContinue} continueLabel="Continue → Set" />
    </div>
  );
}

function SetStep(props: {
  sets: Set[];
  setId: string;
  setSetId: (id: string) => void;
  mode: "pick" | "create";
  setMode: (m: "pick" | "create") => void;
  newName: string;
  setNewName: (s: string) => void;
  newDate: string;
  setNewDate: (s: string) => void;
  newLocation: string;
  setNewLocation: (s: string) => void;
  newPhotographer: string;
  setNewPhotographer: (s: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-4">
      <ModeToggle mode={props.mode} setMode={props.setMode} />
      {props.mode === "pick" ? (
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Set</Label>
          {props.sets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sets for this character yet — create one.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {props.sets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => props.setSetId(s.id)}
                  className={`w-full flex items-center justify-between rounded-md border p-2 text-left text-sm transition ${
                    props.setId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.date && <p className="text-xs text-muted-foreground">{s.date}</p>}
                  </div>
                  {props.setId === s.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="set-name">Set name</Label>
            <Input id="set-name" value={props.newName} onChange={(e) => props.setNewName(e.target.value)} placeholder="e.g. Studio Shoot 01" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="set-date">Date</Label>
              <Input id="set-date" type="date" value={props.newDate} onChange={(e) => props.setNewDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="set-loc">Location</Label>
              <Input id="set-loc" value={props.newLocation} onChange={(e) => props.setNewLocation(e.target.value)} placeholder="e.g. Studio Asahi, Tokyo" />
            </div>
          </div>
          <div>
            <Label htmlFor="set-ph">Photographer (optional)</Label>
            <Input id="set-ph" value={props.newPhotographer} onChange={(e) => props.setNewPhotographer(e.target.value)} placeholder="e.g. K. Watanabe" />
          </div>
        </div>
      )}

      <StepActions onBack={props.onBack} onContinue={props.onFinish} continueLabel="Assign to set" />
    </div>
  );
}
