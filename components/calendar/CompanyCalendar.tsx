"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { CalendarEvent } from "@/lib/types";

interface Props {
  events: CalendarEvent[];
  // Clients live under /portal and can't reach /admin routes; default is admin.
  portal?: boolean;
}

// FullCalendar all-day end dates are exclusive (the day *after* the last visible day).
// Adding 1 day ensures the event bar spans the full intended range.
function exclusiveEnd(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
}

export default function CompanyCalendar({ events, portal = false }: Props) {
  const fcEvents = events.map((e) => {
    const endBase = e.end ?? e.start;
    return {
      id: e.entity_id,
      title: e.title,
      start: e.start,
      end: endBase ? exclusiveEnd(endBase) : undefined,
      color: e.color,
      extendedProps: {
        entity_type: e.entity_type,
        project_id: e.project_id,
      },
    };
  });

  return (
    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-3 sm:p-5 overflow-hidden">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        }}
        buttonText={{
          today: "Today",
          month: "Month",
          week: "Week",
          list: "List",
        }}
        events={fcEvents}
        height="auto"
        eventClick={(info) => {
          const { entity_type, project_id } = info.event.extendedProps;
          if (!project_id) return;
          if (portal) {
            // Portal has a single project page; no per-section sub-routes.
            window.location.href = `/portal/projects/${project_id}`;
          } else {
            window.location.href = `/admin/projects/${project_id}/${
              entity_type === "task" ? "tasks" : entity_type === "deliverable" ? "deliverables" : ""
            }`;
          }
        }}
        eventClassNames="cursor-pointer"
        dayMaxEvents={4}
      />
    </div>
  );
}
