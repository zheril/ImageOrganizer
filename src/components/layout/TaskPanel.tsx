"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task } from "@/lib/db/dexie";
import { useUI } from "@/lib/store/ui";
import { X, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { relativeTime } from "@/lib/format";

export function TaskPanel() {
  const { taskPanelOpen, setTaskPanel } = useUI();
  const tasks = useLiveQuery(async () => {
    const arr = await db.tasks.orderBy("createdAt").reverse().toArray();
    return arr.slice(0, 50);
  }) ?? [];

  if (!taskPanelOpen) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-medium">Background tasks</h2>
        <button onClick={() => setTaskPanel(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y">
        {tasks.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No tasks yet.</p>
        ) : (
          tasks.map((t) => <TaskRow key={t.id} task={t} />)
        )}
      </div>
    </aside>
  );
}

function TaskRow({ task }: { task: Task }) {
  const pct = task.total > 0 ? Math.round((task.progress / task.total) * 100) : 0;
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-1">
        {task.status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : task.status === "done" ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : task.status === "error" ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-medium capitalize">{task.type}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{relativeTime(task.createdAt)}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-1">{task.message}</p>
      {task.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        {task.progress}/{task.total || "?"}
      </p>
    </div>
  );
}
