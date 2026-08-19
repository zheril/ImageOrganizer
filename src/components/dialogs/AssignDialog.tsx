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

export function AssignDialog() {
  const { assignDialogOpen, assignDialogIds, closeAssignDialog } = useUI();
  const [step, setStep] = useState<"cosplayer" | "character" | "set" | "done">("cosplayer");

  // selections
  const [cosplayerId, setCosplayerId] = useState<string>("");
  const [cosplayerMode, setCosplayerMode] = useState<"pick" | "create">("pick");
  const [newCosplayerName, setNewCosplayerName] = useState("");
  const [newCosplayerAlias, setNewCosplayerAlias] = useState("");

  const [characterId, setCharacterId] = useState<string>("");
  const [characterMode, setCharacterMode] = useState<"pick" | "create">("pick");
  const [newCharName, setNewCharName] = useState("");
  const [newCharFranchise, setNewCharFranchise] = useState("");

  const [setId, setSetId] = useState<string>("");
  const [setMode, setSetMode] = useState<"pick" | "create">("pick");
  const [newSetName, setNewSetName] = useState("");
  const [newSetDate, setNewSetDate] = useState("");
  const [newSetLocation, setNewSetLocation] = useState("");
  const [newSetPhotographer, setNewSetPhotographer] = useState("");

  const cosplayers = useLiveQuery(() => db.cosplayers.orderBy("name").toArray()) ?? [];
  const characters = useLiveQuery(
    async () => (cosplayerId ? db.characters.where("cosplayerId").equals(cosplayerId).toArray() : []),
    [cosplayerId],
  ) ?? [];
  const sets = useLiveQuery(
    async () => (characterId ? db.sets.where("characterId").equals(characterId).toArray() : []),
    [characterId],
  ) ?? [];

  // Media being assigned (for preview)
  const mediaItems = useLiveQuery(async () => {
    if (assignDialogIds.length === 0) return [];
    return db.media.bulkGet(assignDialogIds);
  }, [assignDialogIds]) ?? [];

  // Reset when opened
  useEffect(() => {
    if (assignDialogOpen) {
      setStep("cosplayer");
      setCosplayerId("");
      setCosplayerMode("pick");
      setNewCosplayerName("");
      setNewCosplayerAlias("");
      setCharacterId("");
      setCharacterMode("pick");
      setNewCharName("");
      setNewCharFranchise("");
      setSetId("");
      setSetMode("pick");
      setNewSetName("");
      setNewSetDate("");
      setNewSetLocation("");
      setNewSetPhotographer("");
    }
  }, [assignDialogOpen]);

  const count = assignDialogIds.length;

  // Step handlers
  async function goCharacterStep() {
    if (cosplayerMode === "create") {
      if (!newCosplayerName.trim()) {
        toast.error("Cosplayer name required");
        return;
      }
      const id = uid("cosp");
      await db.cosplayers.put({
        id,
        name: newCosplayerName.trim(),
        alias: newCosplayerAlias.trim() || undefined,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setCosplayerId(id);
    }
    if (!cosplayerId && cosplayerMode === "pick") {
      toast.error("Pick a cosplayer");
      return;
    }
    setStep("character");
  }
  async function goSetStep() {
    if (characterMode === "create") {
      if (!newCharName.trim()) {
        toast.error("Character name required");
        return;
      }
      const id = uid("char");
      await db.characters.put({
        id,
        cosplayerId: cosplayerId,
        name: newCharName.trim(),
        franchise: newCharFranchise.trim() || undefined,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setCharacterId(id);
    }
    if (!characterId && characterMode === "pick") {
      toast.error("Pick a character");
      return;
    }
    setStep("set");
  }
  async function finish() {
    if (setMode === "create") {
      if (!newSetName.trim()) {
        toast.error("Set name required");
        return;
      }
      const id = uid("set");
      await db.sets.put({
        id,
        characterId,
        cosplayerId,
        name: newSetName.trim(),
        date: newSetDate || undefined,
        location: newSetLocation || undefined,
        photographer: newSetPhotographer || undefined,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setSetId(id);
      await commitAssignmentWithIds(cosplayerId, characterId, id);
      closeAssignDialog();
    } else {
      if (!setId) {
        toast.error("Pick a set");
        return;
      }
      await commitAssignmentWithIds(cosplayerId, characterId, setId);
      closeAssignDialog();
    }
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Organize {count} media
          </DialogTitle>
          <DialogDescription>
            Bulk-assign these media to a Cosplayer → Character → Set.
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb steps */}
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-1 text-sm">
            <StepChip active={step === "cosplayer"} done={step !== "cosplayer"}>
              Cosplayer
            </StepChip>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <StepChip active={step === "character"} done={step === "set"}>
              Character
            </StepChip>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <StepChip active={step === "set"}>Set</StepChip>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] overflow-hidden">
          {/* Left: form */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {step === "cosplayer" && (
              <CosplayerStep
                cosplayers={cosplayers}
                cosplayerId={cosplayerId}
                setCosplayerId={setCosplayerId}
                mode={cosplayerMode}
                setMode={setCosplayerMode}
                newName={newCosplayerName}
                setNewName={setNewCosplayerName}
                newAlias={newCosplayerAlias}
                setNewAlias={setNewCosplayerAlias}
                onContinue={goCharacterStep}
              />
            )}
            {step === "character" && (
              <CharacterStep
                characters={characters}
                characterId={characterId}
                setCharacterId={setCharacterId}
                mode={characterMode}
                setMode={setCharacterMode}
                newName={newCharName}
                setNewName={setNewCharName}
                newFranchise={newCharFranchise}
                setNewFranchise={setNewCharFranchise}
                onBack={() => setStep("cosplayer")}
                onContinue={goSetStep}
              />
            )}
            {step === "set" && (
              <SetStep
                sets={sets}
                setId={setId}
                setSetId={setSetId}
                mode={setMode}
                setMode={setSetMode}
                newName={newSetName}
                setNewName={setNewSetName}
                newDate={newSetDate}
                setNewDate={setNewSetDate}
                newLocation={newSetLocation}
                setNewLocation={setNewSetLocation}
                newPhotographer={newSetPhotographer}
                setNewPhotographer={setNewSetPhotographer}
                onBack={() => setStep("character")}
                onFinish={finish}
              />
            )}
          </div>

          {/* Right: media preview */}
          <div className="border-l bg-muted/20 overflow-y-auto max-h-[60vh] p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {count} selected
            </p>
            <div className="grid grid-cols-2 gap-2">
              {mediaItems.slice(0, 12).map((m) => (
                m && (
                  <div key={m.id} className="aspect-[4/3] rounded-md overflow-hidden">
                    <MediaThumbnail media={m} size="tiny" className="w-full h-full" />
                  </div>
                )
              ))}
              {mediaItems.length > 12 && (
                <div className="aspect-[4/3] rounded-md bg-muted/40 grid place-items-center text-xs text-muted-foreground">
                  +{mediaItems.length - 12} more
                </div>
              )}
            </div>
          </div>
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
