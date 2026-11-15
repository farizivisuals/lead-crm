"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@/lib/types";

const VALID_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "cancelled"];

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<{ error?: string }> {
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
  revalidatePath(`/portal/projects/${projectId}`);
  return {};
}

export async function updateProjectDetails(
  projectId: string,
  details: { name: string; description: string; start_date: string; target_end_date: string }
): Promise<{ error?: string }> {
  const name = details.name.trim();
  if (!name) return { error: "Project name is required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description: details.description.trim() || null,
      start_date: details.start_date || null,
      target_end_date: details.target_end_date || null,
    })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
  revalidatePath(`/portal/projects/${projectId}`);
  return {};
}

export async function updateMoodboardUrl(projectId: string, url: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Goes through a SECURITY DEFINER function so executives and assigned
  // creatives can edit the moodboard without full project-update rights.
  const { error } = await supabase.rpc("set_project_moodboard", {
    p_project_id: projectId,
    p_url: url,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  return {};
}
