"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { toast } from "sonner";
import {
  FolderOpen, Plus, RefreshCw, Trash2, AlertTriangle, FolderInput,
  HardDrive, CheckCircle2, Unplug, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime, formatNumber } from "@/lib/format";
import {
  supportsFsAccess, addWatchedFolder, scanWatchedFolder,
  reconnectFolder, rescanAllWatchedFolders, queryReadPermission,
} from "@/lib/fs";

export function FoldersView() {
  const folders = useLiveQuery(() => db.folders.orderBy("addedAt").reverse().toArray()) ?? [];
  const totalMedia = useLiveQuery(() => db.media.count()) ?? 0;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ folderId: string; msg: string } | null>(null);
  const fsSupported = supportsFsAccess();

  const handleAdd = useCallback(async () => {
    if (!fsSupported) {
      toast.error("Your browser doesn't support folder watching. Use Chrome or Edge.");
      return;
    }
    setBusy(true);
    try {
      const folder = await addWatchedFolder();
      if (!folder) {
        setBusy(false);
        return; // user cancelled
      }
      toast.info(`Scanning "${folder.name}"…`);
      setProgress({ folderId: folder.id, msg: "Scanning…" });
      const result = await scanWatchedFolder(folder.id);
      setProgress(null);
      toast.success(
        `Added "${folder.name}" — ${result.added} new file${result.added === 1 ? "" : "s"}`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Could not add folder");
    } finally {
      setBusy(false);
    }
  }, [fsSupported]);

  const handleRescan = useCallback(async (folderId: string, name: string) => {
    setBusy(true);
    setProgress({ folderId, msg: "Rescanning…" });
    try {
      const r = await scanWatchedFolder(folderId);
      toast.success(
        `"${name}" rescanned — +${r.added} new, -${r.removed} removed, ${r.updated} changed`,
      );
    } catch (e: any) {
      toast.error(e?.message || `Rescan failed for "${name}"`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, []);

  const handleReconnect = useCallback(async (folderId: string, name: string) => {
    setBusy(true);
    try {
      const ok = await reconnectFolder(folderId);
      if (ok) toast.success(`Reconnected to "${name}"`);
      else toast.error(`Permission denied for "${name}"`);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleRemove = useCallback(async (folderId: string, name: string) => {
    const choice = confirm(
      `Remove watched folder "${name}"?\n\n` +
      `Choose OK to also remove its indexed media from the library.\n` +
      `(Cancel keeps the media but the folder won't be rescanned.)\n\n` +
      `Note: Original files on disk are NEVER touched by this app.`,
    );
    if (choice) {
      // Remove all media belonging to this folder
      const all = await db.media.where("folderId").equals(folderId).toArray();
      // Also clean up their thumbnails
      for (const m of all) {
        if (m.thumbKey) {
          const keys = ["tiny", "medium", "large", "poster"].map((s) => `${m.thumbKey}:${s}`);
          await db.thumbs.bulkDelete(keys);
        }
      }
      await db.media.bulkDelete(all.map((m) => m.id));
      await db.folders.delete(folderId);
      toast.success(`Removed "${name}" and ${all.length} media from library`);
    } else {
      // Just unlink folder record (keep media but null folderId)
      await db.folders.delete(folderId);
      toast.success(`Removed "${name}" from watched folders (media kept)`);
    }
  }, []);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Hero banner */}
        <div className="rounded-xl border bg-card p-6 flex items-center gap-4">
          <div className="grid place-items-center h-12 w-12 rounded-xl bg-primary/10">
            <HardDrive className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Watched Folders</h2>
            <p className="text-sm text-muted-foreground">
              Link a folder on your computer. Drop photos/videos into it anytime —
              they'll be detected on next launch or rescan.
              {totalMedia > 0 && (
                <span className="ml-1">· {formatNumber(totalMedia)} media indexed</span>
              )}
            </p>
          </div>
          <Button onClick={handleAdd} disabled={busy} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Watch a folder
          </Button>
        </div>

        {/* Add-area (empty state) */}
        {folders.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center">
            <FolderInput className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No folders watched yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
              Click <strong>Watch a folder</strong> above and pick a folder from your
              computer. The app remembers it across sessions — every photo you drop
              in that folder will appear here automatically.
            </p>
            {!fsSupported && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Your browser doesn't support File System Access (try Chrome or Edge)
              </p>
            )}
          </div>
        )}

        {/* Folders list */}
        {folders.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-medium">Watched folders</h3>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await rescanAllWatchedFolders();
                  setBusy(false);
                  if (r.scanned === 0) {
                    toast.info("No folders were rescannable — try reconnecting permissions.");
                  } else {
                    toast.success(`Rescanned ${r.scanned} folder(s) — +${r.added} new, -${r.removed} removed`);
                  }
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                Rescan all
              </Button>
            </div>
            <div className="divide-y">
              {folders.map((f) => (
                <FolderRow
                  key={f.id}
                  folder={f}
                  busy={busy}
                  progress={progress?.folderId === f.id ? progress.msg : null}
                  onRescan={() => handleRescan(f.id, f.name)}
                  onReconnect={() => handleReconnect(f.id, f.name)}
                  onRemove={() => handleRemove(f.id, f.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Help / safety note */}
        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">File-system safety</p>
          <p>
            Cosvault only <strong>reads</strong> your folders. It never moves, renames,
            or deletes original files on disk. Removing a folder from the library only
            removes its indexed entries — your photos stay where they are.
          </p>
        </div>
      </div>
    </div>
  );
}

interface FolderRowProps {
  folder: {
    id: string;
    name: string;
    path: string;
    addedAt: number;
    lastScannedAt?: number;
    fileCount: number;
    dirHandle?: any;
    permission?: "granted" | "prompt" | "denied" | "unknown";
  };
  busy: boolean;
  progress: string | null;
  onRescan: () => void;
  onReconnect: () => void;
  onRemove: () => void;
}

function FolderRow({ folder, busy, progress, onRescan, onReconnect, onRemove }: FolderRowProps) {
  // Re-check permission on mount (since stored permission may be stale)
  const [perm, setPerm] = useState(folder.permission || "unknown");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!folder.dirHandle) {
        setPerm("unknown");
        return;
      }
      const p = await queryReadPermission(folder.dirHandle);
      if (!cancelled) setPerm(p);
    })();
    return () => { cancelled = true; };
  }, [folder.dirHandle, folder.id, folder.permission]);

  const needsReconnect = perm === "prompt" || perm === "denied" || perm === "unknown";

  return (
    <div className="p-4 flex items-center gap-3">
      <div className="grid place-items-center h-9 w-9 rounded-lg bg-muted/40">
        {needsReconnect ? (
          <Unplug className="h-4 w-4 text-amber-500" />
        ) : (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{folder.name}</p>
          {perm === "granted" && (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          )}
          {needsReconnect && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-medium">
              <AlertTriangle className="h-2.5 w-2.5" />
              Permission needed
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {folder.fileCount} media · added {relativeTime(folder.addedAt)}
          {folder.lastScannedAt && ` · scanned ${relativeTime(folder.lastScannedAt)}`}
          {progress && <span className="ml-1 text-primary">· {progress}</span>}
        </p>
      </div>
      {needsReconnect ? (
        <Button
          variant="default"
          size="sm"
          className="gap-1"
          disabled={busy}
          onClick={onReconnect}
        >
          <Unplug className="h-3.5 w-3.5" />
          Reconnect
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          disabled={busy}
          onClick={onRescan}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy && progress ? "animate-spin" : ""}`} />
          Rescan
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-red-500 hover:text-red-600"
        disabled={busy}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </Button>
    </div>
  );
}
