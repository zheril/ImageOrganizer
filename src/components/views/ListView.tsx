"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Heart, Clock, Eye } from "lucide-react";
import { formatNumber } from "@/lib/format";

export function FavoritesView() {
  const count = useLiveQuery(async () => {
    const arr = await db.media.toArray();
    return arr.filter((m) => m.favorite).length;
  });
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-red-500/5 flex items-center gap-3">
        <div className="grid place-items-center h-8 w-8 rounded-full bg-red-500/15">
          <Heart className="h-4 w-4 fill-red-500 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium">{count !== undefined ? `${formatNumber(count)} favorites` : "Loading…"}</p>
          <p className="text-xs text-muted-foreground">Items you've marked as favorite.</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MediaGrid query={{ favoritesOnly: true }} />
      </div>
    </div>
  );
}

export function RecentlyAddedView() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-3">
        <div className="grid place-items-center h-8 w-8 rounded-full bg-primary/15">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Recently added</p>
          <p className="text-xs text-muted-foreground">The 200 most recently imported items.</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MediaGrid query={{ recentlyAdded: true }} />
      </div>
    </div>
  );
}

export function RecentlyViewedView() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-3">
        <div className="grid place-items-center h-8 w-8 rounded-full bg-primary/15">
          <Eye className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Recently viewed</p>
          <p className="text-xs text-muted-foreground">Items you've opened in the viewer.</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MediaGrid query={{ recentlyViewed: true }} />
      </div>
    </div>
  );
}

export function AllMediaView() {
  return <MediaGrid />;
}
