import Dexie, { type Table } from "dexie";

// ---------- Domain Types ----------
export interface Cosplayer {
  id: string;
  name: string;
  alias?: string;
  coverMediaId?: string;
  notes?: string;
  socialLinks?: string[];
  tags: string[]; // tag ids
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  cosplayerId: string;
  name: string;
  franchise?: string;
  coverMediaId?: string;
  notes?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Set {
  id: string;
  characterId: string;
  cosplayerId: string; // denormalized for fast filtering
  name: string;
  date?: string; // ISO date
  location?: string;
  event?: string;
  photographer?: string;
  camera?: string;
  notes?: string;
  description?: string;
  coverMediaId?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type MediaKind = "image" | "video";

export interface MediaExif {
  camera?: string;
  lens?: string;
  iso?: number | string;
  aperture?: string;
  shutter?: string;
  focalLength?: string;
  takenAt?: string;
  gps?: { lat: number; lon: number };
}

export interface Media {
  id: string;
  // hierarchy (any may be null when in Inbox)
  cosplayerId?: string;
  characterId?: string;
  setId?: string;
  // source
  folderId?: string;
  filename: string;
  // For demo seed entries: remote URL (https://picsum.photos/...).
  // For real local imports: empty string — the file is resolved via `fileHandle`.
  sourceUrl: string;
  // Persistent File System Access handle for local files — survives reloads.
  // Stored as `any` because TS lib types vary by browser; IndexedDB structured-clone supports it.
  fileHandle?: any;
  // physical attributes
  fileSize: number; // bytes
  mimeType: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  duration?: number; // seconds for videos
  fileCreated?: number;
  fileModified?: number;
  // cache
  thumbKey?: string; // sha1 of (path+size+mtime)
  // discovery
  rating: number; // 0..5
  favorite: boolean;
  tags: string[];
  exif?: MediaExif;
  importedAt: number;
  lastViewedAt?: number;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastScannedAt?: number;
  fileCount: number;
  // Persistent File System Access handle for the watched directory.
  dirHandle?: any;
  // Permission state last seen — used to show "Reconnect" UI without async checks on every render
  permission?: "granted" | "prompt" | "denied" | "unknown";
}

export interface TagDef {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface EventDef {
  id: string;
  name: string;
  date?: string;
  location?: string;
  notes?: string;
  createdAt: number;
}

export interface LocationDef {
  id: string;
  name: string;
  notes?: string;
  createdAt: number;
}

// Thumbnail blob store. key = thumbKey + size code.
export interface ThumbBlob {
  key: string; // `${mediaThumbKey}:${size}` e.g. "abc123:medium"
  mediaId: string;
  size: "tiny" | "medium" | "large" | "poster";
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export type TaskStatus = "queued" | "running" | "done" | "cancelled" | "error";

export interface Task {
  id: string;
  type: "scan" | "thumbs" | "metadata" | "hashes" | "dedupe" | "search-index";
  status: TaskStatus;
  progress: number;
  total: number;
  message: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ---------- Dexie DB ----------
class CosOrganizerDB extends Dexie {
  cosplayers!: Table<Cosplayer, string>;
  characters!: Table<Character, string>;
  sets!: Table<Set, string>;
  media!: Table<Media, string>;
  folders!: Table<Folder, string>;
  tags!: Table<TagDef, string>;
  events!: Table<EventDef, string>;
  locations!: Table<LocationDef, string>;
  thumbs!: Table<ThumbBlob, string>;
  tasks!: Table<Task, string>;

  constructor() {
    super("cos-organizer");
    this.version(1).stores({
      cosplayers: "id, name, createdAt",
      characters: "id, cosplayerId, name, franchise, createdAt",
      sets: "id, characterId, cosplayerId, name, createdAt",
      media: "id, cosplayerId, characterId, setId, folderId, kind, favorite, rating, importedAt, lastViewedAt, *tags",
      folders: "id, name, path, addedAt",
      tags: "id, name",
      events: "id, name",
      locations: "id, name",
      thumbs: "key, mediaId, size, createdAt",
      tasks: "id, type, status, createdAt",
    });
  }
}

export const db = new CosOrganizerDB();

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

// Deterministic thumb key based on source attributes
export async function computeThumbKey(input: {
  sourceUrl: string;
  fileSize: number;
  fileModified?: number;
}): Promise<string> {
  const raw = `${input.sourceUrl}|${input.fileSize}|${input.fileModified ?? 0}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
