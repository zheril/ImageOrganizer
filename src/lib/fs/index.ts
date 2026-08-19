import { db, uid, type Media, type Folder } from "@/lib/db/dexie";

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"];
const VIDEO_EXT = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"];

export function isSupportedFile(name: string): "image" | "video" | null {
  const lower = name.toLowerCase();
  if (IMAGE_EXT.some((e) => lower.endsWith(e))) return "image";
  if (VIDEO_EXT.some((e) => lower.endsWith(e))) return "video";
  return null;
}

// Check if the File System Access API is available in this browser.
export function supportsFsAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// Open the native directory picker. Returns the handle or null if user cancels.
export async function pickDirectory(): Promise<any | null> {
  if (!supportsFsAccess()) return null;
  try {
    // @ts-expect-error - not in TS lib
    return await window.showDirectoryPicker();
  } catch {
    return null; // user cancelled
  }
}

// Query current permission state without prompting.
export async function queryReadPermission(handle: any): Promise<"granted" | "prompt" | "denied" | "unknown"> {
  if (!handle) return "unknown";
  try {
    if (typeof handle.queryPermission !== "function") return "unknown";
    const perm = await handle.queryPermission({ mode: "read" });
    return perm;
  } catch {
    return "unknown";
  }
}

// Request read permission (may prompt the user — must be called from a user gesture).
export async function requestReadPermission(handle: any): Promise<"granted" | "denied" | "prompt"> {
  if (!handle) return "denied";
  try {
    if (typeof handle.requestPermission !== "function") return "denied";
    const perm = await handle.requestPermission({ mode: "read" });
    return perm;
  } catch {
    return "denied";
  }
}

// Recursively walk a directory handle, yielding all file handles found.
export async function walkDirectory(
  dirHandle: any,
  onProgress?: (scanned: number) => void,
): Promise<{ fileHandle: any; path: string; name: string }[]> {
  const out: { fileHandle: any; path: string; name: string }[] = [];
  let count = 0;
  const stack: { handle: any; prefix: string }[] = [{ handle: dirHandle, prefix: "" }];
  while (stack.length) {
    const { handle: h, prefix } = stack.shift()!;
    // @ts-expect-error - values() not in TS lib
    for await (const entry of h.values()) {
      if (entry.kind === "directory") {
        stack.push({
          handle: entry,
          prefix: prefix ? `${prefix}/${entry.name}` : entry.name,
        });
      } else if (entry.kind === "file") {
        out.push({
          fileHandle: entry,
          path: prefix ? `${prefix}/${entry.name}` : entry.name,
          name: entry.name,
        });
        count++;
        if (onProgress && count % 50 === 0) onProgress(count);
      }
    }
  }
  return out;
}

// Compute a deterministic cache key for a local file
async function computeThumbKeyFromAttrs(path: string, size: number, mtime: number): Promise<string> {
  const raw = `${path}|${size}|${mtime}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Delete all cached thumbnails for a given media thumb key (all sizes)
async function deleteThumbsForKey(thumbKey: string) {
  const sizes = ["tiny", "medium", "large", "poster"] as const;
  const keys = sizes.map((s) => `${thumbKey}:${s}`);
  await db.thumbs.bulkDelete(keys as string[]);
}

// Scan a watched folder: detect new/removed/changed files and update the DB.
export async function scanWatchedFolder(folderId: string): Promise<{
  added: number;
  removed: number;
  updated: number;
  total: number;
}> {
  const folder = await db.folders.get(folderId);
  if (!folder || !folder.dirHandle) {
    return { added: 0, removed: 0, updated: 0, total: 0 };
  }

  // Ensure we have read permission
  const perm = await requestReadPermission(folder.dirHandle);
  if (perm !== "granted") {
    await db.folders.update(folderId, { permission: perm });
    throw new Error(`Permission not granted for "${folder.name}"`);
  }
  await db.folders.update(folderId, { permission: "granted" });

  // Walk and collect all file handles
  const discovered = await walkDirectory(folder.dirHandle);

  // Build a quick lookup of existing media by relative path
  const existing = await db.media.where("folderId").equals(folderId).toArray();
  const existingByPath = new Map<string, Media>();
  for (const m of existing) {
    if (!m.sourceUrl.startsWith("http")) {
      existingByPath.set(m.sourceUrl, m);
    }
  }

  let added = 0;
  let updated = 0;
  const seenPaths = new Set<string>();

  for (const { fileHandle, path, name } of discovered) {
    const kind = isSupportedFile(name);
    if (!kind) continue;

    seenPaths.add(path);

    let file: File;
    try {
      file = await fileHandle.getFile();
    } catch {
      continue;
    }

    const existingMedia = existingByPath.get(path);
    const isChanged =
      !existingMedia ||
      existingMedia.fileSize !== file.size ||
      existingMedia.fileModified !== Math.floor(file.lastModified / 1000);

    if (!existingMedia) {
      const id = uid("med");
      const newThumbKey = await computeThumbKeyFromAttrs(
        path,
        file.size,
        Math.floor(file.lastModified / 1000),
      );
      await db.media.put({
        id,
        folderId,
        filename: name,
        sourceUrl: path,
        fileHandle,
        fileSize: file.size,
        mimeType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
        kind,
        rating: 0,
        favorite: false,
        tags: [],
        importedAt: Date.now(),
        fileCreated: Math.floor(file.lastModified / 1000),
        fileModified: Math.floor(file.lastModified / 1000),
        thumbKey: newThumbKey,
      });
      added++;
    } else if (isChanged) {
      const newThumbKey = await computeThumbKeyFromAttrs(
        path,
        file.size,
        Math.floor(file.lastModified / 1000),
      );
      if (existingMedia.thumbKey && existingMedia.thumbKey !== newThumbKey) {
        await deleteThumbsForKey(existingMedia.thumbKey);
      }
      await db.media.update(existingMedia.id, {
        fileHandle,
        fileSize: file.size,
        fileModified: Math.floor(file.lastModified / 1000),
        fileCreated: Math.floor(file.lastModified / 1000),
        thumbKey: newThumbKey,
      });
      updated++;
    }
  }

  // Detect removed files (in DB but not on disk)
  let removed = 0;
  for (const m of existing) {
    if (m.sourceUrl.startsWith("http")) continue;
    if (!seenPaths.has(m.sourceUrl)) {
      if (m.thumbKey) await deleteThumbsForKey(m.thumbKey);
      await db.media.delete(m.id);
      removed++;
    }
  }

  await db.folders.update(folderId, {
    lastScannedAt: Date.now(),
    fileCount: existing.length + added - removed,
    permission: "granted",
  });

  return {
    added,
    removed,
    updated,
    total: existing.length + added - removed,
  };
}

// Compare two directory handles by resolve — `isSameEntry` is the proper API.
async function sameHandle(a: any, b: any): Promise<boolean> {
  try {
    return await a.isSameEntry(b);
  } catch {
    return false;
  }
}

// Pick individual files (not a folder) using the File System Access API.
// Returns persistent handles we can store on Media records.
export async function pickFiles(): Promise<{ fileHandle: any; file: File }[] | null> {
  if (typeof window === "undefined" || !("showOpenFilePicker" in window)) return null;
  try {
    // @ts-expect-error - not in TS lib
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: "Images & Videos",
          accept: {
            "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"],
            "video/*": [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"],
          },
        },
      ],
      excludeAcceptAllOption: false,
    });
    const out: { fileHandle: any; file: File }[] = [];
    for (const h of handles) {
      try {
        const file = await h.getFile();
        out.push({ fileHandle: h, file });
      } catch {}
    }
    return out;
  } catch {
    return null; // user cancelled
  }
}

// Check if showOpenFilePicker is available
export function supportsFilePicker(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

// Add a new watched folder. Returns the folder record.
export async function addWatchedFolder(): Promise<Folder | null> {
  const handle = await pickDirectory();
  if (!handle) return null;
  const existing = await db.folders.where("name").equals(handle.name).first();
  if (existing && existing.dirHandle && await sameHandle(existing.dirHandle, handle)) {
    return existing;
  }
  const id = uid("fdr");
  const folder: Folder = {
    id,
    name: handle.name,
    path: handle.name,
    addedAt: Date.now(),
    fileCount: 0,
    dirHandle: handle,
    permission: "granted",
  };
  await db.folders.put(folder);
  return folder;
}

// Get a fresh File object from a media record (handles both remote + local).
export async function getFileForMedia(m: Media): Promise<File | Blob | null> {
  if (m.sourceUrl && m.sourceUrl.startsWith("http")) {
    try {
      const r = await fetch(m.sourceUrl, { mode: "cors" });
      if (!r.ok) return null;
      return await r.blob();
    } catch {
      return null;
    }
  }
  if (m.fileHandle) {
    try {
      const perm = await queryReadPermission(m.fileHandle);
      if (perm === "prompt") {
        await requestReadPermission(m.fileHandle);
      }
      return await m.fileHandle.getFile();
    } catch (e) {
      console.warn("getFileForMedia failed:", m.id, e);
      return null;
    }
  }
  return null;
}

// Auto-rescan all watched folders whose permission is already granted.
// Called on app launch. Returns a summary for toasts.
export async function rescanAllWatchedFolders(): Promise<{ scanned: number; added: number; removed: number }> {
  const folders = await db.folders.toArray();
  let scanned = 0;
  let added = 0;
  let removed = 0;
  for (const f of folders) {
    if (!f.dirHandle) continue;
    const perm = await queryReadPermission(f.dirHandle);
    if (perm === "granted") {
      try {
        const r = await scanWatchedFolder(f.id);
        scanned++;
        added += r.added;
        removed += r.removed;
      } catch (e) {
        console.warn(`Rescan failed for ${f.name}:`, e);
      }
    } else {
      await db.folders.update(f.id, { permission: perm });
    }
  }
  return { scanned, added, removed };
}

// Re-prompt for permission to a folder (called from a button click)
export async function reconnectFolder(folderId: string): Promise<boolean> {
  const f = await db.folders.get(folderId);
  if (!f || !f.dirHandle) return false;
  const perm = await requestReadPermission(f.dirHandle);
  if (perm === "granted") {
    await db.folders.update(folderId, { permission: "granted" });
    await scanWatchedFolder(folderId);
    return true;
  }
  await db.folders.update(folderId, { permission: perm });
  return false;
}
