import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { taskProgress, type Progress, type TaskProgressRow } from '../data';

export type ProjectListRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  target_end_date: string | null;
  updated_at: string;
  clients: { company_name: string } | { company_name: string }[] | null;
  project_departments:
    | { department_id: string; is_primary: boolean; departments: { name: string; slug: string } | { name: string; slug: string }[] | null }[]
    | null;
};

export function useProjectsList() {
  return useQuery({
    queryKey: qk.projects(),
    queryFn: async (): Promise<{
      projects: ProjectListRow[];
      progress: Record<string, Progress>;
    }> => {
      const [projectsRes, tasksRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, clients(company_name), project_departments(*, departments(name, slug))')
          .order('updated_at', { ascending: false }),
        // Deliberately unfiltered, exactly as the web query: RLS already scopes
        // `tasks` to the same visible projects, so the client reduces the whole
        // result into a per-project progress map. Do not add a project filter.
        supabase.from('tasks').select('project_id, department_stages(is_terminal)'),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      return {
        projects: (projectsRes.data ?? []) as unknown as ProjectListRow[],
        progress: taskProgress((tasksRes.data ?? []) as unknown as TaskProgressRow[]),
      };
    },
  });
}

export type ClientOption = { id: string; company_name: string };
export type DepartmentOption = { id: string; name: string; slug: string };
export type CreativeOption = { profile_id: string; full_name: string };

export function useProjectFormOptions() {
  return useQuery({
    queryKey: qk.projectFormOptions(),
    queryFn: async () => {
      const [clientsRes, deptsRes, creativesRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('departments').select('*').order('name'),
        supabase
          .from('employees')
          .select('profile_id, profiles(full_name), employee_departments!inner(departments!inner(slug))')
          .eq('employee_departments.departments.slug', 'creatives'),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      if (deptsRes.error) throw deptsRes.error;
      if (creativesRes.error) throw creativesRes.error;
      return {
        clients: (clientsRes.data ?? []) as ClientOption[],
        departments: (deptsRes.data ?? []) as DepartmentOption[],
        creatives: (creativesRes.data ?? []).map((row: any) => ({
          profile_id: row.profile_id as string,
          full_name:
            (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.full_name ??
            'Unknown',
        })) as CreativeOption[],
      };
    },
  });
}

export type CreateProjectInput = {
  client_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  target_end_date: string;
  /** Order matters: the FIRST entry becomes the primary department. */
  departmentIds: string[];
  creativeProfileIds: string[];
  userId: string;
};

/**
 * Three sequential writes with manual rollback, matching NewProjectDialog.tsx.
 * There is no transaction or RPC on the web either — if the department or
 * creative insert fails, the just-created project row is deleted rather than
 * left half-formed. Reproduce that, including the ordering.
 */
export async function createProject(input: CreateProjectInput): Promise<string> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      client_id: input.client_id,
      name: input.name,
      description: input.description || null,
      status: input.status,
      start_date: input.start_date || null,
      target_end_date: input.target_end_date || null,
      owner_profile_id: input.userId,
      created_by: input.userId,
    })
    .select()
    .single();
  if (projectError || !project) throw projectError ?? new Error('Project insert returned no row');

  const projectId = project.id as string;

  const { error: deptError } = await supabase.from('project_departments').insert(
    input.departmentIds.map((dept_id, i) => ({
      project_id: projectId,
      department_id: dept_id,
      // First selected department is primary — order-dependent, so the picker
      // must preserve selection order (see the screen's toggle helper).
      is_primary: i === 0,
    }))
  );
  if (deptError) {
    await supabase.from('projects').delete().eq('id', projectId);
    throw deptError;
  }

  if (input.creativeProfileIds.length > 0) {
    const { error: creativesError } = await supabase.from('project_creatives').insert(
      input.creativeProfileIds.map((profile_id) => ({ project_id: projectId, profile_id }))
    );
    if (creativesError) {
      await supabase.from('projects').delete().eq('id', projectId);
      throw creativesError;
    }
  }

  return projectId;
}
