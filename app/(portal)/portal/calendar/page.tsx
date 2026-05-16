import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CompanyCalendar from "@/components/calendar/CompanyCalendar";
import type { CalendarEvent } from "@/lib/types";

export default async function PortalCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contact } = await supabase
    .from("client_contacts")
    .select("client_id")
    .eq("profile_id", user.id)
    .single();
  if (!contact) redirect("/portal");

  // Get project IDs for this client
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, start_date, target_end_date")
    .eq("client_id", contact.client_id);

  const projectIds = (projects ?? []).map((p) => p.id);

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("id, title, submitted_at, project_id")
    .in("project_id", projectIds)
    .in("status", ["client_review", "approved"]);

  const events: CalendarEvent[] = [
    ...(projects ?? []).filter((p) => p.start_date || p.target_end_date).map((p) => ({
      id: p.id,
      entity_id: p.id,
      entity_type: "project" as const,
      title: `📁 ${p.name}`,
      start: p.start_date ?? p.target_end_date ?? "",
      end: p.target_end_date ?? null,
      color: "#10b981",
      department_id: null,
      client_id: contact.client_id,
      project_id: p.id,
    })),
    ...(deliverables ?? []).map((d) => ({
      id: d.id,
      entity_id: d.id,
      entity_type: "deliverable" as const,
      title: `📦 ${d.title}`,
      start: d.submitted_at,
      end: null,
      color: "#f59e0b",
      department_id: null,
      client_id: contact.client_id,
      project_id: d.project_id,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500 text-sm mt-1">Your project timelines and deliverables</p>
      </div>
      <CompanyCalendar events={events} />
    </div>
  );
}
