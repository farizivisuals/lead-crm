import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';
import { one } from '../data';

export type StageChangeRow = {
  id: string;
  moved_at: string;
  tasks: { title: string } | { title: string }[] | null;
  from_stage: { name: string } | { name: string }[] | null;
  to_stage: { name: string } | { name: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export type StageChange = {
  id: string;
  movedAt: string;
  actor: string;
  taskTitle: string;
  fromStage: string | null;
  toStage: string;
};

/**
 * `tasks!inner` is load-bearing. Without it, a filter on the embedded resource
 * does not restrict the parent rows — PostgREST only nulls the embed where it
 * does not match — so the query returns every project's stage changes. The web
 * page shipped without it and listed the whole agency's history under one
 * project's heading.
 *
 * Shared with the dashboard feed in `dashboard.ts`, which uses the same select
 * without the project filter. One string, so the two cannot drift.
 */
export const STAGE_HISTORY_SELECT =
  '*, tasks!inner(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)';

/**
 * Flattens one task_stage_history row into what the screens render.
 * `from_stage_id` is nullable — the first move into any stage has none — and
 * the sentence must drop the "from" clause rather than print an empty name.
 */
export function describeStageChange(row: StageChangeRow): StageChange {
  return {
    id: row.id,
    movedAt: row.moved_at,
    actor: one(row.profiles)?.full_name ?? 'Someone',
    taskTitle: one(row.tasks)?.title ?? 'a task',
    fromStage: one(row.from_stage)?.name ?? null,
    toStage: one(row.to_stage)?.name ?? '—',
  };
}

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: qk.projectActivity(projectId),
    queryFn: async (): Promise<StageChange[]> => {
      const { data, error } = await supabase
        .from('task_stage_history')
        .select(STAGE_HISTORY_SELECT)
        .eq('tasks.project_id', projectId)
        .order('moved_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as StageChangeRow[]).map(describeStageChange);
    },
  });
}
