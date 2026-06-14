"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@/lib/types";

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
}

export async function updateMoodboardUrl(projectId: string, url: string | null) {
  const supabase = await createClient();
  // Goes through a SECURITY DEFINER function so executives and assigned
  // creatives can edit the moodboard without full project-update rights.
  const { error } = await supabase.rpc("set_project_moodboard", {
    p_project_id: projectId,
    p_url: url,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}
