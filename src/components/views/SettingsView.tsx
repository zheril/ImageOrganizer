"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { useConfig, DEFAULT_LABELS, DEFAULT_NAV_VISIBILITY, type ViewKey, type FieldLabels } from "@/lib/store/config";
import { Settings as SettingsIcon, Trash2, Database, Moon, Sun, HardDriveDownload, Sparkles, WandSparkles, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const mediaCount = useLiveQuery(() => db.media.count()) ?? 0;
  const cosplayerCount = useLiveQuery(() => db.cosplayers.count()) ?? 0;
  const charCount = useLiveQuery(() => db.characters.count()) ?? 0;
  const setCount = useLiveQuery(() => db.sets.count()) ?? 0;
  const thumbCount = useLiveQuery(() => db.thumbs.count()) ?? 0;
  const thumbSizeBytes = useLiveQuery(async () => {
    const all = await db.thumbs.toArray();
    return all.reduce((acc, t) => acc + t.blob.size, 0);
  }) ?? 0;
  const fieldLabels = useConfig((s) => s.fieldLabels);
  const navVisibility = useConfig((s) => s.navVisibility);
  const setNavVisibility = useConfig((s) => s.setNavVisibility);
  const setFieldLabel = useConfig((s) => s.setFieldLabel);
  const resetConfig = useConfig((s) => s.resetConfig);

  async function clearThumbs() {
    if (!confirm(`Clear ${thumbCount} cached thumbnails? They will be regenerated on demand.`)) return;
    setBusy(true);
    await db.thumbs.clear();
    setBusy(false);
    toast.success("Thumbnail cache cleared");
  }

  async function loadDemoData() {
    if (mediaCount > 0 && !confirm("This will add demo data on top of your current library. Continue?")) return;
    setBusy(true);
    try {
      await seedDatabaseIfEmpty();
      toast.success("Demo data loaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load demo data");
    } finally {
      setBusy(false);
    }
  }

  async function resetLibrary() {
    if (!confirm("Reset the entire library?\n\nThis will remove all cosplayers, characters, sets, media, and folders from the local database.\n\nNo external files are touched.")) return;
    setBusy(true);
    await Promise.all([
      db.cosplayers.clear(),
      db.characters.clear(),
      db.sets.clear(),
      db.media.clear(),
      db.folders.clear(),
      db.tags.clear(),
      db.events.clear(),
      db.locations.clear(),
      db.thumbs.clear(),
      db.tasks.clear(),
    ]);
    setBusy(false);
    toast.success("Library reset");
    setTimeout(() => location.reload(), 600);
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Appearance */}
        <Section icon={<SettingsIcon className="h-4 w-4" />} title="Appearance">
          <Row label="Theme" hint="Switch between light and dark mode.">
            <div className="inline-flex items-center gap-2 text-sm">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </Button>
            </div>
          </Row>
        </Section>

        {/* Library */}
        <Section icon={<Database className="h-4 w-4" />} title="Library">
          <Stat label={fieldLabels.cosplayerPlural} value={cosplayerCount} />
          <Stat label={fieldLabels.characterPlural} value={charCount} />
          <Stat label={fieldLabels.setPlural} value={setCount} />
          <Stat label="Media" value={mediaCount} />
        </Section>

        {/* Customize sidebar */}
        <Section icon={<Eye className="h-4 w-4" />} title="Customize sidebar">
          <p className="text-xs text-muted-foreground px-4 py-2">
            Hide sidebar items you don't use. Items that are hidden don't appear in the sidebar navigation.
          </p>
          <NavCustomizeRow itemKey="all" defaultLabel="All Media" />
          <NavCustomizeRow itemKey="inbox" defaultLabel="Inbox" />
          <NavCustomizeRow itemKey="favorites" defaultLabel="Favorites" />
          <NavCustomizeRow itemKey="recently-added" defaultLabel="Recently Added" />
          <NavCustomizeRow itemKey="recently-viewed" defaultLabel="Recently Viewed" />
          <NavCustomizeRow itemKey="cosplayers" defaultLabel="Artists" plural />
          <NavCustomizeRow itemKey="characters" defaultLabel="Subjects" plural />
          <NavCustomizeRow itemKey="sets" defaultLabel="Albums" plural />
          <NavCustomizeRow itemKey="tags" defaultLabel="Tags" plural />
          <NavCustomizeRow itemKey="events" defaultLabel="Events" plural />
          <NavCustomizeRow itemKey="locations" defaultLabel="Locations" plural />
          <NavCustomizeRow itemKey="folders" defaultLabel="Folders" />
        </Section>

        {/* Field labels */}
        <Section icon={<WandSparkles className="h-4 w-4" />} title="Field labels">
          <p className="text-xs text-muted-foreground px-4 py-2">
            Rename the hierarchy levels to fit your use case. For example, rename "Artist" → "Photographer" to repurpose Cosvault for general photography.
            Labels update everywhere in the UI (sidebar, headings, buttons, dialogs).
          </p>
          <FieldLabelRow field="cosplayer" label="Artist (singular)" />
          <FieldLabelRow field="cosplayerPlural" label="Artist (plural)" />
          <FieldLabelRow field="character" label="Subject (singular)" />
          <FieldLabelRow field="characterPlural" label="Subject (plural)" />
          <FieldLabelRow field="set" label="Album (singular)" />
          <FieldLabelRow field="setPlural" label="Album (plural)" />
          <FieldLabelRow field="tag" label="Tag (singular)" />
          <FieldLabelRow field="tagPlural" label="Tag (plural)" />
          <FieldLabelRow field="event" label="Event (singular)" />
          <FieldLabelRow field="eventPlural" label="Event (plural)" />
          <FieldLabelRow field="location" label="Location (singular)" />
          <FieldLabelRow field="locationPlural" label="Location (plural)" />
          <Row label="Reset to defaults" hint="Restore all labels and sidebar visibility to factory defaults.">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                resetConfig();
                toast.success("Reset to defaults");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </Row>
        </Section>

        {/* Cache */}
        <Section icon={<HardDriveDownload className="h-4 w-4" />} title="Cache">
          <Stat label="Cached thumbnails" value={thumbCount} />
          <Stat label="Cache size" value={formatBytes(thumbSizeBytes)} />
          <Row label="Clear thumbnail cache" hint="Regenerate on next view. No effect on library.">
            <Button variant="outline" size="sm" className="gap-1" onClick={clearThumbs} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Clear cache
            </Button>
          </Row>
        </Section>

        {/* Demo data */}
        <Section icon={<WandSparkles className="h-4 w-4" />} title="Demo data">
          <Row
            label="Load demo data"
            hint="Adds 4 sample cosplayers, 33 characters, 15 sets, and ~638 media (from picsum.photos). Use this to explore the UI before adding your own photos."
          >
            <Button variant="outline" size="sm" className="gap-1" onClick={loadDemoData} disabled={busy}>
              <Sparkles className="h-3.5 w-3.5" /> Load demo
            </Button>
          </Row>
        </Section>

        {/* Data */}
        <Section icon={<Sparkles className="h-4 w-4" />} title="Data">
          <Row
            label="Reset library"
            hint="Wipes all local data: cosplayers, characters, sets, media, folders. Original files on disk are NOT touched."
            danger
          >
            <Button variant="destructive" size="sm" className="gap-1" onClick={resetLibrary} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Reset everything
            </Button>
          </Row>
        </Section>

        {/* About */}
        <Section icon={<Sparkles className="h-4 w-4" />} title="About">
          <p className="text-xs text-muted-foreground px-4 py-3 leading-relaxed">
            <strong>Cosvault</strong> is a local-first cosplay photo & video organizer.
            All data stays in your browser via IndexedDB. Original files on disk
            are never modified or moved — only indexed.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <div className="divide-y">
        {children}
      </div>
    </div>
  );
}

function Row({ label, hint, children, danger }: { label: string; hint?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${danger ? "text-red-500" : ""}`}>{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

// Sidebar-visibility toggle row. `plural` indicates the label can be renamed
// via the Field labels section above (so we show the current custom label,
// not the default).
function NavCustomizeRow({
  itemKey,
  defaultLabel,
  plural = false,
}: {
  itemKey: ViewKey;
  defaultLabel: string;
  plural?: boolean;
}) {
  const visible = useConfig((s) => s.navVisibility[itemKey] !== false);
  const setNavVisibility = useConfig((s) => s.setNavVisibility);
  const labels = useConfig((s) => s.fieldLabels);

  // Compute display label: use custom label if this item has one, else default
  let label = defaultLabel;
  if (plural) {
    if (itemKey === "cosplayers") label = labels.cosplayerPlural;
    else if (itemKey === "characters") label = labels.characterPlural;
    else if (itemKey === "sets") label = labels.setPlural;
    else if (itemKey === "tags") label = labels.tagPlural;
    else if (itemKey === "events") label = labels.eventPlural;
    else if (itemKey === "locations") label = labels.locationPlural;
  }

  return (
    <div className="px-4 py-2 flex items-center justify-between gap-4">
      <div className="min-w-0 flex items-center gap-2">
        {visible ? (
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
        <span className={`text-sm ${visible ? "" : "text-muted-foreground/60"}`}>{label}</span>
      </div>
      <Switch checked={visible} onCheckedChange={(v) => setNavVisibility(itemKey, v)} />
    </div>
  );
}

function FieldLabelRow({
  field,
  label,
}: {
  field: keyof FieldLabels;
  label: string;
}) {
  const value = useConfig((s) => s.fieldLabels[field]);
  const setFieldLabel = useConfig((s) => s.setFieldLabel);
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
      <Label className="text-xs text-muted-foreground min-w-[140px]">{label}</Label>
      <Input
        value={value}
        onChange={(e) => setFieldLabel(field, e.target.value)}
        className="h-8 max-w-xs text-sm"
      />
    </div>
  );
}
