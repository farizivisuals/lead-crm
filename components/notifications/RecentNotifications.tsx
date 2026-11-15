"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatRelative, cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

/** Dashboard card: the latest notifications, live. The full list is the bell. */
export default function RecentNotifications({ userId, limit = 6 }: { userId: string; limit?: number }) {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Notification[]>([]);
  // Task notifications link to their project's task list.
  const [taskProject, setTaskProject] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    const list = (data ?? []) as Notification[];
    setRows(list);
    const taskIds = list.filter((n) => n.entity_type === "task" && n.entity_id).map((n) => n.entity_id);
    if (taskIds.length) {
      const { data: tasks } = await supabase.from("tasks").select("id, project_id").in("id", taskIds);
      setTaskProject(Object.fromEntries((tasks ?? []).map((t) => [t.id, t.project_id])));
    }
  }, [supabase, userId, limit]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`dash-notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase, userId]);

  function hrefFor(n: Notification): string | null {
    if (n.entity_type === "project") return `/admin/projects/${n.entity_id}`;
    if (n.entity_type === "task" && taskProject[n.entity_id]) {
      return `/admin/projects/${taskProject[n.entity_id]}/tasks#task-${n.entity_id}`;
    }
    return null;
  }

  async function markRead(n: Notification) {
    if (n.is_read) return;
    setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
  }

  const unread = rows.filter((n) => !n.is_read).length;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
          <Bell className="h-3.5 w-3.5 text-zinc-300" />
        </div>
        <span className="text-sm font-semibold text-white">Notifications</span>
        {unread > 0 && (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-zinc-900">
            {unread} new
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-white/35">Nothing yet. Changes to your tasks will show up here.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((n) => {
            const href = hrefFor(n);
            const body = (
              <div className="flex gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                <span
                  className={cn("mt-1.5 h-2 w-2 rounded-full flex-shrink-0", n.is_read ? "bg-transparent" : "bg-sky-400")}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm truncate", n.is_read ? "text-white/60" : "text-white font-medium")}>
                    {n.title}
                  </p>
                  <p className="text-xs text-white/40 truncate">{n.body}</p>
                </div>
                <span className="text-[10px] text-white/30 flex-shrink-0 mt-0.5">{formatRelative(n.created_at)}</span>
              </div>
            );
            return (
              <li key={n.id} onClick={() => markRead(n)}>
                {href ? <Link href={href}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-5 py-2.5 text-[11px] text-white/30 border-t border-white/[0.05]">
        See all with the bell at the top.
      </p>
    </div>
  );
}
