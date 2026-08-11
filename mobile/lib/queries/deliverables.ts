import { useQuery } from '@tanstack/react-query';
import type { DeliverableStatus, DeliverableType, RevisionAction } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type DeliverableRevision = {
  action: RevisionAction;
  note: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export type DeliverableRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  type: DeliverableType;
  title: string;
  dropbox_url: string;
  thumbnail_url: string | null;
  version: number;
  status: DeliverableStatus;
  submitted_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
  deliverable_revisions: DeliverableRevision[] | null;
};

/**
 * The most recent revision by created_at. The web takes `revisions[0]` from a
 * select that never orders `deliverable_revisions`, so which one it shows is
 * whatever PostgREST happens to return. Picking explicitly shows the revision
 * the web means to show.
 */
export function latestRevision(
  revisions: DeliverableRevision[] | null
): DeliverableRevision | null {
  if (!revisions || revisions.length === 0) return null;
  return revisions.reduce((latest, r) => (r.created_at > latest.created_at ? r : latest));
}

export function useDeliverables(projectId: string) {
  return useQuery({
    queryKey: qk.projectDeliverables(projectId),
    queryFn: async (): Promise<DeliverableRow[]> => {
      const { data, error } = await supabase
        .from('deliverables')
        .select(
          '*, profiles:submitted_by(full_name), deliverable_revisions(action, note, created_at, profiles:actor_profile_id(full_name))'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeliverableRow[];
    },
  });
}

export type CreateDeliverableInput = {
  project_id: string;
  task_id: string | null;
  type: DeliverableType;
  title: string;
  dropbox_url: string;
  thumbnail_url: string;
  status: DeliverableStatus;
  submitted_by: string;
};

export async function createDeliverable(input: CreateDeliverableInput) {
  const { error } = await supabase.from('deliverables').insert({
    project_id: input.project_id,
    task_id: input.task_id || null,
    type: input.type,
    title: input.title,
    dropbox_url: input.dropbox_url,
    thumbnail_url: input.thumbnail_url || null,
    status: input.status,
    submitted_by: input.submitted_by,
  });
  if (error) throw error;
}

export type UpdateDeliverableInput = {
  id: string;
  title: string;
  dropbox_url: string;
  thumbnail_url: string;
  status: DeliverableStatus;
  version: number;
};

/**
 * One write, including the version bump. The bump raises `version` and sets
 * `status: 'client_review'` in the same update — the screen puts both into
 * local state before submitting, so there is never a second round-trip and
 * never a second path to the same write.
 */
export async function updateDeliverable(input: UpdateDeliverableInput) {
  const { error } = await supabase
    .from('deliverables')
    .update({
      title: input.title,
      dropbox_url: input.dropbox_url,
      thumbnail_url: input.thumbnail_url || null,
      status: input.status,
      version: input.version,
    })
    .eq('id', input.id);
  if (error) throw error;
}
