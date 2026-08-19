"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Inbox as InboxIcon, Sparkles, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InboxView() {
  const { selectedIds, openAssignDialog, selectMode, setSelectMode } = useUI();
  const inboxCount = useLiveQuery(async () => {
    const arr = await db.media.toArray();
    return arr.filter((m) => !m.cosplayerId || !m.characterId || !m.setId).length;
  });

  const selectedCount = selectedIds.size;
  const ids = Array.from(selectedIds);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-amber-500/5">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-9 w-9 rounded-full bg-amber-500/15">
            <InboxIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {inboxCount !== undefined
                ? `${inboxCount} unorganized media`
                : "Loading…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} selected — click "Assign to set" to organize them`
                : "Toggle Select mode, click media to pick them, then assign Cosplayer → Character → Set"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setSelectMode(!selectMode)}
              disabled={inboxCount === 0}
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              {selectMode ? "Selecting" : "Select"}
            </Button>
            <Button
              size="sm"
              className="gap-1"
              onClick={() => {
                if (selectedCount === 0) {
                  toast.info("Select some media first — click the Select button, then click photos");
                  return;
                }
                openAssignDialog(ids);
              }}
              disabled={selectedCount === 0}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {selectedCount > 0
                ? `Assign ${selectedCount} to set →`
                : "Assign to set"}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MediaGrid query={{ inboxOnly: true }} />
      </div>
    </div>
  );
}
