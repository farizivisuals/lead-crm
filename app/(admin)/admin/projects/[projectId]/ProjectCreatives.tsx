"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, X } from "lucide-react";

interface Creative {
  profile_id: string;
  full_name: string;
}

interface Props {
  projectId: string;
  assigned: Creative[];
  allCreatives: Creative[];
}

export default function ProjectCreatives({ projectId, assigned, allCreatives }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  const available = allCreatives.filter(
    (c) => !assigned.some((a) => a.profile_id === c.profile_id)
  );

  async function addCreative(profile_id: string) {
    setError(null);
    const { error: err } = await supabase
      .from("project_creatives")
      .insert({ project_id: projectId, profile_id });
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  async function removeCreative(profile_id: string) {
    setError(null);
    const { error: err } = await supabase
      .from("project_creatives")
      .delete()
      .eq("project_id", projectId)
      .eq("profile_id", profile_id);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <div className="flex items-center gap-1.5 mb-2">
        <Users className="h-3.5 w-3.5 text-white/30" />
        <span className="text-xs font-medium uppercase tracking-widest text-white/40">Creatives</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {assigned.map((c) => (
          <span
            key={c.profile_id}
            className="group flex items-center gap-1.5 text-xs bg-white/[0.07] text-zinc-300 border border-white/[0.12] pl-2.5 pr-1.5 py-0.5 rounded-full font-medium"
          >
            {c.full_name}
            <button
              onClick={() => removeCreative(c.profile_id)}
              className="text-white/25 hover:text-red-400 transition-colors"
              title="Remove creative"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {assigned.length === 0 && (
          <span className="text-xs text-white/25">No creatives assigned</span>
        )}
        {available.length > 0 && (
          <Select value="" onValueChange={addCreative}>
            <SelectTrigger className="h-6 w-auto rounded-full border-dashed text-xs px-2.5 py-0">
              <SelectValue placeholder="+ Add" />
            </SelectTrigger>
            <SelectContent>
              {available.map((c) => (
                <SelectItem key={c.profile_id} value={c.profile_id}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
