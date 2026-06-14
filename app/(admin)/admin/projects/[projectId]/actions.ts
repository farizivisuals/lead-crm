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
  const { error } = await supabase
    .from("projects")
    .update({ moodboard_url: url })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}
