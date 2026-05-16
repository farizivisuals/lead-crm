import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FolderOpen, CheckSquare, Clock } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: clientCount },
    { count: projectCount },
    { count: taskCount },
    { data: recentActivity },
    { data: recentProjects },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase
      .from("activity_log")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("*, clients(company_name)")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    { label: "Clients", value: clientCount ?? 0, icon: Building2, color: "text-blue-600" },
    { label: "Projects", value: projectCount ?? 0, icon: FolderOpen, color: "text-purple-600" },
    { label: "Active Tasks", value: taskCount ?? 0, icon: CheckSquare, color: "text-green-600" },
  ];

  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your agency&apos;s work</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-gray-50 ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentProjects?.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-gray-400">No projects yet</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentProjects?.map((project) => (
                  <li key={project.id}>
                    <a
                      href={`/admin/projects/${project.id}`}
                      className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{project.name}</p>
                        <p className="text-xs text-gray-400">{(project.clients as { company_name: string })?.company_name}</p>
                      </div>
                      <Badge variant={statusColors[project.status] ?? "secondary"}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity?.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-gray-400">No activity yet</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentActivity?.map((log) => (
                  <li key={log.id} className="px-6 py-3">
                    <div className="flex items-start gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">
                            {(log.profiles as { full_name: string })?.full_name}
                          </span>{" "}
                          {log.action}
                        </p>
                        <p className="text-xs text-gray-400">{formatRelative(log.created_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
