import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, Calendar, LogOut, Zap } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import CommandPalette from "@/components/search/CommandPalette";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, client_contacts(client_id, clients(company_name))")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "client") redirect("/admin/dashboard");

  const clientName = (profile.client_contacts as { clients?: { company_name: string } }[])?.[0]?.clients?.company_name;

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      {/* Top nav — desktop */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-white/[0.03] backdrop-blur-2xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-white/90 text-sm truncate hidden sm:block">
              {clientName ?? "Client Portal"}
            </span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-0.5">
            <Link href="/portal" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-150">
              <FolderOpen className="h-3.5 w-3.5" />
              Projects
            </Link>
            <Link href="/portal/calendar" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-150">
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </Link>
          </nav>

          <div className="flex items-center gap-1.5">
            <CommandPalette portalMode />
            <NotificationBell userId={user.id} />
            <form action="/api/auth/signout" method="POST">
              <button className="p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150" title="Sign out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.07] bg-[#0b0b12]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-around h-16 px-4">
          <Link href="/portal" className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-white/40 hover:text-white transition-colors">
            <FolderOpen className="h-5 w-5" />
            <span className="text-[10px] font-medium">Projects</span>
          </Link>
          <Link href="/portal/calendar" className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-white/40 hover:text-white transition-colors">
            <Calendar className="h-5 w-5" />
            <span className="text-[10px] font-medium">Calendar</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
