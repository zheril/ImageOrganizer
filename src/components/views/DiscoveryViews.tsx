"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { Calendar, MapPin } from "lucide-react";

export function EventsView() {
  const { navigate } = useUI();
  const events = useLiveQuery(async () => {
    const all = await db.media.toArray();
    const eventMap = new Map<string, number>();
    for (const m of all) {
      // Sets store event info, so we'd need to look up sets
    }
    // Just show events from sets for now
    const sets = await db.sets.toArray();
    const map = new Map<string, { name: string; date?: string; location?: string; count: number }>();
    for (const s of sets) {
      if (!s.event) continue;
      const existing = map.get(s.event) || { name: s.event, date: s.date, location: s.location, count: 0 };
      existing.count += 1;
      map.set(s.event, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }) ?? [];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <h2 className="text-sm font-medium">Events</h2>
          </div>
          <div className="divide-y">
            {events.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No events recorded yet.</p>
            ) : events.map((e) => (
              <div key={e.name} className="p-4 flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.date || "—"} · {e.location || "—"} · {e.count} sets
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LocationsView() {
  const locations = useLiveQuery(async () => {
    const sets = await db.sets.toArray();
    const map = new Map<string, { name: string; count: number }>();
    for (const s of sets) {
      if (!s.location) continue;
      const existing = map.get(s.location) || { name: s.location, count: 0 };
      existing.count += 1;
      map.set(s.location, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }) ?? [];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <h2 className="text-sm font-medium">Locations</h2>
          </div>
          <div className="divide-y">
            {locations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No locations recorded yet.</p>
            ) : locations.map((l) => (
              <div key={l.name} className="p-4 flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.count} sets</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
