"use client";

import { useEffect, useRef, useState } from "react";
import { getThumbnail, directUrlFor, type ThumbSize } from "@/lib/thumbs";
import type { Media } from "@/lib/db/dexie";
import { Film } from "lucide-react";

interface Props {
  media: Media;
  size?: ThumbSize;
  className?: string;
  alt?: string;
  // When true, fall back to direct URL for remote media (e.g. picsum) so it
  // appears instantly while cached thumb is being generated. Defaults to true.
  directFallback?: boolean;
}

const SIZE_LONG_EDGE: Record<ThumbSize, number> = {
  tiny: 96,
  medium: 320,
  large: 800,
  poster: 640,
};

function sizedPicsumUrl(seed: string, size: ThumbSize) {
  const long = SIZE_LONG_EDGE[size];
  const w = long;
  const h = Math.round((long * 3) / 4);
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

// Compute synchronous URL if possible (for remote picsum or direct URLs).
function computeDirectUrl(media: Media, size: ThumbSize, directFallback: boolean): string | null {
  if (!directFallback) return null;
  const direct = directUrlFor(media);
  if (!direct) return null;
  if (media.sourceUrl.includes("picsum.photos")) {
    const parts = media.sourceUrl.split("/");
    const seed = parts[parts.length - 2] || parts[parts.length - 1];
    return sizedPicsumUrl(seed, size);
  }
  return direct;
}

interface ThumbState {
  url: string | null;
  errored: boolean;
}

export function MediaThumbnail({
  media,
  size = "medium",
  className = "",
  alt = "",
  directFallback = true,
}: Props) {
  // Initialize state synchronously from direct URL if available.
  // When `media.id`/`size`/`directFallback` changes, the parent should remount
  // us via `key` to retrigger this initializer.
  const [state, setState] = useState<ThumbState>(() => ({
    url: computeDirectUrl(media, size, directFallback),
    errored: false,
  }));
  const urlRef = useRef<string | null>(state.url);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const lastUrl = urlRef.current;
    return () => {
      if (lastUrl && lastUrl.startsWith("blob:")) {
        URL.revokeObjectURL(lastUrl);
      }
    };
  }, []);

  // Only run async fetch when no synchronous URL was available.
  // NOTE: parent components must pass `key={media.id}` so this component
  // remounts when media changes — otherwise the useState initializer won't
  // re-run and the cached URL will be stale.
  useEffect(() => {
    // If we already have a synchronous URL (direct fallback), nothing to fetch.
    if (state.url) return;

    let cancelled = false;
    getThumbnail(media, size).then((r) => {
      if (cancelled) return;
      if (!r) {
        setState({ url: null, errored: true });
        return;
      }
      urlRef.current = r.url;
      setState({ url: r.url, errored: false });
    });

    return () => {
      cancelled = true;
    };
  }, [media.id, size, directFallback, state.url]);

  if (state.errored) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/60 text-muted-foreground ${className}`}
      >
        {media.kind === "video" ? (
          <Film className="h-8 w-8 opacity-60" />
        ) : (
          <span className="text-[10px] uppercase tracking-wider">No preview</span>
        )}
      </div>
    );
  }

  if (!state.url) {
    return <div className={`bg-muted/30 animate-pulse ${className}`} />;
  }

  return (
    <img
      src={state.url}
      alt={alt || media.filename}
      loading="lazy"
      draggable={false}
      className={`${className} object-cover`}
      onError={() => setState((s) => ({ ...s, errored: true }))}
    />
  );
}
