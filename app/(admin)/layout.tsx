import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import NotificationBell from "@/components/notifications/NotificationBell";
import CommandPalette from "@/components/search/CommandPalette";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: employee },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("employees").select("*").eq("profile_id", user.id).single(),
  ]);

  if (!profile || profile.user_type !== "employee") redirect("/portal");
  if (!employee) redirect("/api/auth/signout");

  return (
    <div className="min-h-screen">
      <Sidebar profile={profile} employee={employee} />

      {/* Content area — full width on mobile, offset by sidebar on lg+ */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl gap-3">
          {/* Left: spacer on mobile (hamburger sits here), search on larger screens */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 lg:w-0 flex-shrink-0 lg:hidden" />
            <div className="flex-1 max-w-xs hidden sm:block">
              <CommandPalette />
            </div>
          </div>
          {/* Right: search icon on mobile + bell */}
          <div className="flex items-center gap-2">
            <div className="sm:hidden">
              <CommandPalette />
            </div>
            <NotificationBell userId={user.id} />
          </div>
        </header>

        <main className="p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
