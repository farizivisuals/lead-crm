import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { creativeEmployees } from './projects';
import { one, taskProgress, type TaskProgressRow } from '../data';

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    start_date: string | null;
    target_end_date: string | null;
    moodboard_url: string | null;
    clients: { company_name: string } | { company_name: string }[] | null;
    project_departments:
      | {
          department_id: string;
          is_primary: boolean;
          departments: { name: string; slug: string } | { name: string; slug: string }[] | null;
        }[]
      | null;
  };
  progress: { total: number; done: number };
  deliverableCount: number;
  assignedCreatives: { profile_id: string; full_name: string }[];
  availableCreatives: { profile_id: string; full_name: string }[];
};

/**
 * The roster minus whoever is already on the project — what the "+ Add" picker
 * offers. Getting this wrong silently offers a duplicate `project_creatives`
 * insert, which the unique constraint then rejects at the worst moment.
 */
export function unassignedCreatives<T extends { profile_id: string }>(
  all: T[],
  assigned: { profile_id: string }[]
): T[] {
  const assignedIds = new Set(assigned.map((c) => c.profile_id));
  return all.filter((c) => !assignedIds.has(c.profile_id));
}

export function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: qk.project(projectId),
    queryFn: async (): Promise<ProjectDetail> => {
      const [projectRes, tasksRes, deliverablesRes, assignedRes, allCreatives] =
        await Promise.all([
          supabase
            .from('projects')
            .select('*, clients(company_name), project_departments(*, departments(name, slug))')
            .eq('id', projectId)
            .single(),
          supabase
            .from('tasks')
            .select('department_stages(is_terminal)')
            .eq('project_id', projectId),
          supabase
            .from('deliverables')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId),
          supabase
            .from('project_creatives')
            .select('profile_id, employees(profiles(full_name))')
            .eq('project_id', projectId),
          creativeEmployees(),
        ]);

      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) throw new Error('Project not found');
      if (tasksRes.error) throw tasksRes.error;
      if (deliverablesRes.error) throw deliverablesRes.error;
      if (assignedRes.error) throw assignedRes.error;

      // The task rows carry no project_id (the query is already .eq'd to this
      // project), so key them under `projectId` to reuse the same reducer the
      // projects list uses.
      const progressRows = (tasksRes.data ?? []).map((row: any) => ({
        project_id: projectId,
        department_stages: row.department_stages,
      })) as TaskProgressRow[];

      const assigned = (assignedRes.data ?? []).map((row: any) => ({
        profile_id: row.profile_id as string,
        // Same unwrap as useTaskPickers' projectCreatives — identical select.
        full_name: one<any>(one<any>(row.employees)?.profiles)?.full_name ?? 'Unknown',
      }));

      return {
        project: projectRes.data as unknown as ProjectDetail['project'],
        progress: taskProgress(progressRows)[projectId] ?? { total: 0, done: 0 },
        deliverableCount: deliverablesRes.count ?? 0,
        assignedCreatives: assigned,
        availableCreatives: unassignedCreatives(allCreatives, assigned),
      };
    },
  });
}

/** Web parity: the server action skips a no-op, then plain-updates one column. */
export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
  if (error) throw error;
}

/**
 * Must stay an RPC. `set_project_moodboard` is SECURITY DEFINER and re-checks
 * `is_executive() OR (is_creative() AND can_see_project(id))` server-side; it
 * exists precisely so creatives can write this one column, which the general
 * projects-update policy denies them. A plain .update() here fails for every
 * creative.
 */
export async function updateMoodboardUrl(projectId: string, url: string | null) {
  const { error } = await supabase.rpc('set_project_moodboard', {
    p_project_id: projectId,
    p_url: url,
  });
  if (error) throw error;
}

export async function addProjectCreative(projectId: string, profileId: string) {
  const { error } = await supabase
    .from('project_creatives')
    .insert({ project_id: projectId, profile_id: profileId });
  if (error) throw error;
}

export async function removeProjectCreative(projectId: string, profileId: string) {
  const { error } = await supabase
    .from('project_creatives')
    .delete()
    .eq('project_id', projectId)
    .eq('profile_id', profileId);
  if (error) throw error;
}
