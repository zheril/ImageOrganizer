"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/store/ui";
import { db } from "@/lib/db/dexie";
import { rescanAllWatchedFolders } from "@/lib/fs";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { TaskPanel } from "@/components/layout/TaskPanel";
import { MediaViewer } from "@/components/media/MediaViewer";
import { AssignDialog } from "@/components/dialogs/AssignDialog";
import { EditDialog } from "@/components/dialogs/EditDialog";
import { InboxView } from "@/components/views/InboxView";
import { CosplayersView } from "@/components/views/CosplayersView";
import { CharactersView } from "@/components/views/CharactersView";
import { SetsView } from "@/components/views/SetsView";
import { FoldersView } from "@/components/views/FoldersView";
import { TagsView } from "@/components/views/TagsView";
import { EventsView, LocationsView } from "@/components/views/DiscoveryViews";
import { SettingsView } from "@/components/views/SettingsView";
import { AllMediaView, FavoritesView, RecentlyAddedView, RecentlyViewedView } from "@/components/views/ListView";
import { SeedCleanupBanner } from "@/components/common/SeedCleanupBanner";
import { ListChecks } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Page() {
  const { view, navigate, taskPanelOpen, setTaskPanel, selectedIds, clearSelection } = useUI();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On launch: auto-rescan watched folders (only those whose permission is still granted)
  useEffect(() => {
    (async () => {
      try {
        const r = await rescanAllWatchedFolders();
        if (r.scanned > 0 && (r.added > 0 || r.removed > 0)) {
          toast.success(
            `Rescanned ${r.scanned} folder${r.scanned === 1 ? "" : "s"} — +${r.added} new, -${r.removed} removed`,
          );
        }
      } catch (e) {
        console.warn("Rescan failed", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Keyboard: Esc clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, clearSelection]);

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar (desktop) */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Sidebar (mobile, slide-over) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav button */}
        <div className="lg:hidden flex items-center gap-2 p-2 border-b bg-background">
          <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)} className="gap-1">
            Menu
          </Button>
          <span className="font-semibold text-sm">Cosvault</span>
        </div>

        <TopBar />

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-muted/10 flex flex-col">
            {!ready ? (
              <div className="flex-1 grid place-items-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading library…</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <SeedCleanupBanner />
                <div className="flex-1 min-h-0">
                  <ContentRouter view={view} />
                </div>
              </div>
            )}
          </main>

          <TaskPanel />
        </div>

        {/* Floating task button */}
        <FloatingTaskButton onClick={() => setTaskPanel(!taskPanelOpen)} />
      </div>

      {/* Overlays */}
      <MediaViewer />
      <AssignDialog />
      <EditDialog />
    </div>
  );
}

function ContentRouter({ view }: { view: string }) {
  switch (view) {
    case "all": return <AllMediaView />;
    case "inbox": return <InboxView />;
    case "favorites": return <FavoritesView />;
    case "recently-added": return <RecentlyAddedView />;
    case "recently-viewed": return <RecentlyViewedView />;
    case "cosplayers": return <CosplayersView />;
    case "characters": return <CharactersView />;
    case "sets": return <SetsView />;
    case "tags": return <TagsView />;
    case "events": return <EventsView />;
    case "locations": return <LocationsView />;
    case "folders": return <FoldersView />;
    case "settings": return <SettingsView />;
    default: return <AllMediaView />;
  }
}

function FloatingTaskButton({ onClick }: { onClick: () => void }) {
  const running = useLiveQuery(async () => {
    const arr = await db.tasks.where("status").equals("running").toArray();
    return arr.length;
  });
  if (!running) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-3 py-2 shadow-lg hover:shadow-xl transition"
    >
      <ListChecks className="h-4 w-4" />
      <span className="text-xs">{running} running</span>
    </button>
  );
}
