import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus, DeliverableStatus, DeliverableType, RevisionAction } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { one } from '../data';

/**
 * A client user's rows all hang off client_contacts, not off their profile —
 * the profile only says user_type = 'client'. Every portal query needs the
 * client_id first, so it gets its own hook and every dependent query stays
 * disabled until it resolves.
 */
export function useClientId(userId: string | undefined) {
  return useQuery({
    queryKey: qk.clientContext(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<{ clientId: string; companyName: string } | null> => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('client_id, clients(company_name)')
        .eq('profile_id', userId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        clientId: (data as any).client_id as string,
        companyName: one<{ company_name: string }>((data as any).clients)?.company_name ?? '—',
      };
    },
  });
}

export type PortalProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  project_departments:
    | { departments: { name: string; slug: string } | { name: string; slug: string }[] | null }[]
    | null;
};

export type PortalQuote = {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  valid_until: string | null;
  created_at: string;
  quote_line_items: { quantity: number; unit_price: number }[] | null;
};

export type PortalHome = { projects: PortalProject[]; quotes: PortalQuote[] };

export function usePortalHome(clientId: string | undefined) {
  return useQuery({
    queryKey: qk.portalHome(clientId ?? ''),
    enabled: !!clientId,
    queryFn: async (): Promise<PortalHome> => {
      const [projectsRes, quotesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, project_departments(*, departments(name, slug))')
          .eq('client_id', clientId!)
          .order('updated_at', { ascending: false }),
        supabase
          .from('quotes')
          .select('*, quote_line_items(quantity, unit_price)')
          .eq('client_id', clientId!)
          .order('created_at', { ascending: false }),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (quotesRes.error) throw quotesRes.error;
      return {
        projects: (projectsRes.data ?? []) as unknown as PortalProject[],
        quotes: (quotesRes.data ?? []) as unknown as PortalQuote[],
      };
    },
  });
}

export type PortalRevision = {
  id: string;
  action: RevisionAction;
  note: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export type PortalDeliverable = {
  id: string;
  title: string;
  type: DeliverableType;
  status: DeliverableStatus;
  version: number;
  dropbox_url: string;
  submitted_at: string;
  deliverable_revisions: PortalRevision[] | null;
};

export type PortalProjectDetail = {
  project: { id: string; name: string; status: ProjectStatus; start_date: string | null; target_end_date: string | null };
  deliverables: PortalDeliverable[];
};

export function usePortalProject(projectId: string) {
  return useQuery({
    queryKey: qk.portalProject(projectId),
    queryFn: async (): Promise<PortalProjectDetail> => {
      const [projectRes, deliverablesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, status, start_date, target_end_date')
          .eq('id', projectId)
          .single(),
        supabase
          .from('deliverables')
          .select(
            '*, deliverable_revisions(id, action, note, created_at, profiles:actor_profile_id(full_name))'
          )
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) throw new Error('Project not found');
      if (deliverablesRes.error) throw deliverablesRes.error;
      return {
        project: projectRes.data as unknown as PortalProjectDetail['project'],
        deliverables: (deliverablesRes.data ?? []) as unknown as PortalDeliverable[],
      };
    },
  });
}

export type PortalCalendarEvent = {
  id: string;
  title: string;
  day: string;
  kind: 'project' | 'task' | 'deliverable';
  color: string | null;
  projectId: string;
};

/**
 * Assembled from three queries rather than get_calendar_events, because the
 * portal deliberately shows clients only deliverables in 'client_review' or
 * 'approved' — the RPC has no such filter and would surface drafts.
 */
export function usePortalCalendar(clientId: string | undefined) {
  return useQuery({
    queryKey: qk.portalCalendar(clientId ?? ''),
    enabled: !!clientId,
    queryFn: async (): Promise<PortalCalendarEvent[]> => {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, start_date, target_end_date')
        .eq('client_id', clientId!);
      if (projectsError) throw projectsError;

      const projectIds = (projects ?? []).map((p: any) => p.id as string);
      // `.in` on an empty list matches nothing, which is what we want, but the
      // two follow-up round trips are pure waste in that case.
      if (projectIds.length === 0) return [];

      const [deliverablesRes, tasksRes] = await Promise.all([
        supabase
          .from('deliverables')
          .select('id, title, submitted_at, project_id')
          .in('project_id', projectIds)
          .in('status', ['client_review', 'approved']),
        supabase
          .from('tasks')
          .select('id, title, due_date, project_id, department_stages!current_stage_id(color)')
          .in('project_id', projectIds),
      ]);
      if (deliverablesRes.error) throw deliverablesRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const events: PortalCalendarEvent[] = [];
      for (const p of (projects ?? []) as any[]) {
        const day = p.target_end_date ?? p.start_date;
        if (day) {
          events.push({
            id: `project-${p.id}`,
            title: p.name,
            day: String(day).slice(0, 10),
            kind: 'project',
            color: null,
            projectId: p.id,
          });
        }
      }
      for (const d of (deliverablesRes.data ?? []) as any[]) {
        if (!d.submitted_at) continue;
        events.push({
          id: `deliverable-${d.id}`,
          title: d.title,
          day: String(d.submitted_at).slice(0, 10),
          kind: 'deliverable',
          color: null,
          projectId: d.project_id,
        });
      }
      for (const t of (tasksRes.data ?? []) as any[]) {
        if (!t.due_date) continue;
        events.push({
          id: `task-${t.id}`,
          title: t.title,
          day: String(t.due_date).slice(0, 10),
          kind: 'task',
          color: one<{ color: string | null }>(t.department_stages)?.color ?? null,
          projectId: t.project_id,
        });
      }
      return events.sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title));
    },
  });
}

export type SubmitRevisionInput = {
  deliverableId: string;
  actorProfileId: string;
  action: RevisionAction;
  note: string;
};

/**
 * Inserts the revision and nothing else — web parity. The AFTER INSERT trigger
 * (migration 0009) notifies whoever submitted the deliverable, but it does NOT
 * change deliverables.status: moving a deliverable to 'approved' stays an
 * employee action. Do not add a status write here without changing the web at
 * the same time, or the two clients will disagree about what approval means.
 */
export async function submitRevision(input: SubmitRevisionInput) {
  const { error } = await supabase.from('deliverable_revisions').insert({
    deliverable_id: input.deliverableId,
    actor_profile_id: input.actorProfileId,
    action: input.action,
    note: input.note.trim() || null,
  });
  if (error) throw error;
}
