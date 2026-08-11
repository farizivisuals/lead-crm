import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';
import { one } from '../data';

export type SearchResultType = 'client' | 'project' | 'task' | 'deliverable';

export type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  type: SearchResultType;
  /** The project a task or deliverable belongs to, for navigation. */
  projectId?: string;
};

/** The web requires two characters before searching; below that it shows nothing. */
export const MIN_QUERY = 2;

export function useSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: qk.search(trimmed),
    enabled: trimmed.length >= MIN_QUERY,
    queryFn: async (): Promise<SearchResult[]> => {
      const pat = `%${trimmed}%`;
      const [clientsRes, projectsRes, tasksRes, deliverablesRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').ilike('company_name', pat).limit(4),
        supabase.from('projects').select('id, name, clients(company_name)').ilike('name', pat).limit(4),
        supabase.from('tasks').select('id, title, project_id').ilike('title', pat).limit(4),
        supabase
          .from('deliverables')
          .select('id, title, project_id, projects(name)')
          .ilike('title', pat)
          .limit(4),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (deliverablesRes.error) throw deliverablesRes.error;

      return [
        ...((clientsRes.data ?? []) as any[]).map((c) => ({
          id: c.id as string,
          title: c.company_name as string,
          type: 'client' as const,
        })),
        ...((projectsRes.data ?? []) as any[]).map((p) => ({
          id: p.id as string,
          title: p.name as string,
          subtitle: one<{ company_name: string }>(p.clients)?.company_name,
          type: 'project' as const,
          projectId: p.id as string,
        })),
        ...((tasksRes.data ?? []) as any[]).map((t) => ({
          id: t.id as string,
          title: t.title as string,
          type: 'task' as const,
          projectId: t.project_id as string,
        })),
        ...((deliverablesRes.data ?? []) as any[]).map((d) => ({
          id: d.id as string,
          title: d.title as string,
          subtitle: one<{ name: string }>(d.projects)?.name,
          type: 'deliverable' as const,
          projectId: d.project_id as string,
        })),
      ];
    },
  });
}

export const TYPE_LABELS: Record<SearchResultType, string> = {
  client: 'Client',
  project: 'Project',
  task: 'Task',
  deliverable: 'Deliverable',
};

/** Groups results by type, preserving the type order the queries ran in. */
export function groupByType(results: SearchResult[]): { type: SearchResultType; items: SearchResult[] }[] {
  const order: SearchResultType[] = ['client', 'project', 'task', 'deliverable'];
  return order
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((group) => group.items.length > 0);
}
