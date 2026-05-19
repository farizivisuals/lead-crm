"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { CalendarEvent } from "@/lib/types";

interface Props {
  events: CalendarEvent[];
}

export default function CompanyCalendar({ events }: Props) {
  const fcEvents = events.map((e) => ({
    id: e.entity_id,
    title: e.title,
    start: e.start,
    end: e.end ?? e.start,
    color: e.color,
    extendedProps: {
      entity_type: e.entity_type,
      project_id: e.project_id,
    },
  }));

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
          if (project_id) {
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
