import { db, type Media } from "@/lib/db/dexie";
import { getFileForMedia } from "@/lib/fs";

// Multiple thumbnail sizes (longest edge in px) - optimized for fast rendering
export const SIZES = {
  tiny: 80,
  medium: 280,
  large: 640,
  poster: 480, // video poster
} as const;

export type ThumbSize = keyof typeof SIZES;

// Compute cache key for a media item's thumbnail
async function mediaThumbKey(m: Media): Promise<string> {
  if (m.thumbKey) return m.thumbKey;
  const raw = `${m.sourceUrl}|${m.fileSize}|${m.fileModified ?? 0}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const arr = Array.from(new Uint8Array(digest));
  const key = arr.map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.media.update(m.id, { thumbKey: key });
  return key;
}

// ---------- Image thumbnail ----------
async function imageThumbBlob(
  file: Blob,
  size: ThumbSize,
): Promise<{ blob: Blob; width: number; height: number; naturalWidth: number; naturalHeight: number }> {
  const bitmap = await createImageBitmap(file);
  const naturalWidth = bitmap.width;
  const naturalHeight = bitmap.height;
  const longest = Math.max(naturalWidth, naturalHeight);
  const target = SIZES[size];
  const scale = longest > target ? target / longest : 1;
  const w = Math.max(1, Math.round(naturalWidth * scale));
  const h = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  let blob: Blob;
  try {
    blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.70 });
  } catch {
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.70 });
  }
  return { blob, width: w, height: h, naturalWidth, naturalHeight };
}

// ---------- Video poster ----------
async function videoPosterBlob(
  file: Blob,
  size: ThumbSize,
): Promise<{ blob: Blob; width: number; height: number; duration: number }> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    v.crossOrigin = "anonymous";

    v.onloadedmetadata = () => {
      // Seek to 10% in or 1s, whichever smaller
      const t = Math.min(Math.max(0.1, v.duration * 0.1), 1);
      v.currentTime = t;
    };
    v.onseeked = () => {
      try {
        const longest = Math.max(v.videoWidth, v.videoHeight);
        const target = SIZES[size];
        const scale = longest > target ? target / longest : 1;
        const w = Math.max(1, Math.round(v.videoWidth * scale));
        const h = Math.max(1, Math.round(v.videoHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(v, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob)
              resolve({
                blob,
                width: w,
                height: h,
                duration: v.duration || 0,
              });
            else reject(new Error("Failed to capture video frame"));
          },
          "image/webp",
          0.70,
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video load error"));
    };
  });
}

// ---------- Public API ----------
// Fetch a fresh blob/File for a media item — handles remote URLs and local file
// handles. Used by both the thumbnail generator and the viewer for playback.
export async function fetchBlobForMedia(m: Media): Promise<Blob | null> {
  return (await getFileForMedia(m)) as Blob | null;
}

export async function getThumbnail(
  m: Media,
  size: ThumbSize,
): Promise<{ url: string; width: number; height: number } | null> {
  const key = await mediaThumbKey(m);
  const cacheKey = `${key}:${size}`;
  const cached = await db.thumbs.get(cacheKey);
  if (cached) {
    return {
      url: URL.createObjectURL(cached.blob),
      width: cached.width,
      height: cached.height,
    };
  }

  // Generate
  try {
    const blob = await fetchBlobForMedia(m);
    if (!blob) return null;
    let result:
      | { blob: Blob; width: number; height: number; duration?: number }
      | null = null;
    if (m.kind === "image") {
      result = await imageThumbBlob(blob, size);
    } else {
      result = await videoPosterBlob(blob, size);
      // Store video dimensions/duration back onto media record if missing
      if (result && (!m.width || !m.duration)) {
        await db.media.update(m.id, {
          width: result.width,
          height: result.height,
          duration: result.duration,
        });
      }
    }
    if (!result) return null;
    await db.thumbs.put({
      key: cacheKey,
      mediaId: m.id,
      size,
      blob: result.blob,
      width: result.width,
      height: result.height,
      createdAt: Date.now(),
    });
    // Also extract natural dimensions if missing for images
    if (m.kind === "image" && "naturalWidth" in result && result.naturalWidth && result.naturalHeight) {
      await db.media.update(m.id, {
        width: result.naturalWidth,
        height: result.naturalHeight,
      });
    }
    return {
      url: URL.createObjectURL(result.blob),
      width: result.width,
      height: result.height,
    };
  } catch (e) {
    console.warn("thumb gen failed", m.id, e);
    return null;
  }
}

// Lightweight: return the URL without forcing generation if missing
export async function peekThumbnail(
  m: Media,
  size: ThumbSize,
): Promise<string | null> {
  if (!m.thumbKey) return null;
  const cached = await db.thumbs.get(`${m.thumbKey}:${size}`);
  if (!cached) return null;
  return URL.createObjectURL(cached.blob);
}

// For media items that are remote URLs (demo seed), we can also use the URL
// directly as a thumb source (with size query). Used for initial seed display
// while thumbs generate in background.
export function directUrlFor(m: Media): string | null {
  if (m.sourceUrl.startsWith("http")) return m.sourceUrl;
  return null;
}
