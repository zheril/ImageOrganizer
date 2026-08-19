"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { AlertTriangle, X, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SEED_FLAG_KEY = "cosvault.seed.wasLoaded";
const DISMISS_FLAG_KEY = "cosvault.seed.dismissedAt";

// Returns true if the current DB appears to contain demo seed data
// (any media whose sourceUrl points at picsum.photos)
function useHasSeedData() {
  return useLiveQuery(async () => {
    const count = await db.media.count();
    if (count === 0) return false;
    // Check a sample
    const sample = await db.media.limit(10).toArray();
    return sample.some((m) => m.sourceUrl.startsWith("http") && m.sourceUrl.includes("picsum.photos"));
  }) ?? false;
}

/**
 * One-time banner shown to users who had the old auto-seeded library.
 * Lets them clear the demo data and start fresh with their own folder.
 */
export function SeedCleanupBanner() {
  const hasSeed = useHasSeedData();
  const [dismissed, setDismissed] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DISMISS_FLAG_KEY);
      if (d) setDismissed(true);
    } catch {}
  }, []);

  const show = hasSeed && !dismissed;
  if (!show) return null;

  async function clearDemo() {
    if (!confirm(
      "Remove all demo data?\n\n" +
      "This deletes the 638 sample photos from your local database so you can start fresh with your own folder.\n\n" +
      "Original files on disk are NEVER touched (these demo entries just point at remote picsum.photos URLs anyway)."
    )) return;
    setClearing(true);
    try {
      await Promise.all([
        db.cosplayers.clear(),
        db.characters.clear(),
        db.sets.clear(),
        db.media.clear(),
        db.tags.clear(),
        db.events.clear(),
        db.locations.clear(),
        db.thumbs.clear(),
      ]);
      try { localStorage.removeItem(SEED_FLAG_KEY); localStorage.removeItem(DISMISS_FLAG_KEY); } catch {}
      toast.success("Demo data cleared");
      setTimeout(() => location.reload(), 600);
    } finally {
      setClearing(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_FLAG_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  }

  return (
    <div className="mx-4 my-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Your library contains demo data from a previous version
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
          The app no longer auto-loads demo data. Clean it up to start fresh with your own photos.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="gap-1" onClick={clearDemo} disabled={clearing}>
          <Trash2 className="h-3.5 w-3.5" /> Clear demo
        </Button>
        <Button variant="ghost" size="sm" className="gap-1" onClick={dismiss}>
          Keep <ArrowRight className="h-3 w-3" />
        </Button>
        <button onClick={dismiss} className="text-amber-500/60 hover:text-amber-500 ml-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
