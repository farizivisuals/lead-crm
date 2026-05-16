import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LogOut, FolderOpen, Calendar } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

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
    <div className="min-h-screen bg-gray-50">
      {/* Portal top nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">L</span>
            </div>
            <span className="font-semibold text-gray-900">{clientName ?? "Client Portal"}</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/portal" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <FolderOpen className="h-4 w-4" />
              Projects
            </Link>
            <Link href="/portal/calendar" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <Calendar className="h-4 w-4" />
              Calendar
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell userId={user.id} />
          <form action="/api/auth/signout" method="POST">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
