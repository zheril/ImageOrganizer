"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type TagDef } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Tag as TagIcon, Plus, X, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#9b59b6", "#27ae60", "#c0392b", "#16a085", "#f39c12",
  "#2980b9", "#8e44ad", "#1abc9c", "#d35400", "#34495e",
];

export function TagsView() {
  const { params, navigate } = useUI();
  const tagId = params.tagId;
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const tags = useLiveQuery(async () => {
    const all = await db.tags.toArray();
    const allMedia = await db.media.toArray();
    return all
      .map((t) => ({
        ...t,
        count: allMedia.filter((m) => m.tags.includes(t.id)).length,
      }))
      .sort((a, b) => b.count - a.count);
  }) ?? [];

  if (tagId) return <TagDetail tagId={tagId} />;

  async function createTag() {
    if (!newName.trim()) return;
    const id = `tag_${Math.random().toString(36).slice(2, 10)}`;
    await db.tags.put({ id, name: newName.trim(), color: newColor, createdAt: Date.now() });
    setNewName("");
  }
  async function deleteTag(t: TagDef) {
    const allMedia = await db.media.toArray();
    for (const m of allMedia) {
      if (m.tags.includes(t.id)) {
        await db.media.update(m.id, { tags: m.tags.filter((x) => x !== t.id) });
      }
    }
    await db.tags.delete(t.id);
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium mb-3">New tag</p>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. swimsuit, armor, favorite-photographer"
              onKeyDown={(e) => e.key === "Enter" && createTag()}
              className="max-w-md"
            />
            <div className="flex items-center gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn("h-5 w-5 rounded-full transition", newColor === c && "ring-2 ring-offset-2 ring-offset-background ring-foreground")}
                  style={{ background: c }}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
            <Button size="sm" className="gap-1" onClick={createTag}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* Cloud */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Tag cloud</p>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet</p>
            ) : (
              tags.map((t) => {
                const size = Math.min(28, 12 + Math.log2(t.count + 2) * 3);
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate("tags", { tagId: t.id }, t.name)}
                    className="group inline-flex items-center gap-1 rounded-full border border-border bg-card hover:shadow-sm transition px-3 py-1"
                  >
                    <Hash className="h-3 w-3" style={{ color: t.color }} />
                    <span className="font-medium" style={{ fontSize: `${size * 0.6}px` }}>{t.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t.count}</span>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); deleteTag(t); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TagDetail({ tagId }: { tagId: string }) {
  const { navigate } = useUI();
  const tag = useLiveQuery(() => db.tags.get(tagId), [tagId]);
  if (!tag) return <div className="p-8 text-center text-muted-foreground">Tag not found.</div>;
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
        <button onClick={() => navigate("tags")} className="text-xs text-muted-foreground hover:text-foreground">
          ← Tags
        </button>
        <div className="ml-2 flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" style={{ color: tag.color }} />
          <span className="font-medium">{tag.name}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MediaGrid query={{ tagId }} />
      </div>
    </div>
  );
}
