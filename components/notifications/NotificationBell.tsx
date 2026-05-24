"use client";
import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  }, [userId, supabase]);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_profile_id=eq.${userId}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, userId, supabase]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true })
      .eq("recipient_profile_id", userId).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-150">
          <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-1 h-4 w-4 rounded-full bg-white text-zinc-900 text-[9px] flex items-center justify-center font-bold shadow-lg shadow-white/20"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[420px] overflow-y-auto bg-[#0e0e16]/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/60 rounded-2xl p-0"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
          <span className="text-sm font-semibold text-white">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="h-6 w-6 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/30">All caught up</p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 px-4 py-3 cursor-pointer border-b border-white/[0.05] last:border-0 focus:bg-white/[0.06] ${
                  !n.is_read ? "bg-white/[0.04]" : ""
                }`}
                onClick={() => markRead(n.id)}
              >
                <div className="flex items-start gap-2 w-full">
                  {!n.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0 mt-1.5" />
                  )}
                  <div className={!n.is_read ? "" : "pl-3.5"}>
                    <p className="text-sm font-medium text-white/90 leading-tight">{n.title}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[11px] text-white/30 mt-1">{formatRelative(n.created_at)}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
