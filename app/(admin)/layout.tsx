import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import NotificationBell from "@/components/notifications/NotificationBell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: employee, error: empError },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("employees").select("*").eq("profile_id", user.id).single(),
  ]);

  if (!profile || profile.user_type !== "employee") redirect("/portal");

  // No employee record → sign out to avoid a redirect loop
  if (!employee) redirect("/api/auth/signout");

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar profile={profile} employee={employee} />
      <div className="pl-64">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6 sticky top-0 z-30">
          <NotificationBell userId={user.id} />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
