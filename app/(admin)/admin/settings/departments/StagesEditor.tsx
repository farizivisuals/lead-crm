"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Loader2, CheckCircle } from "lucide-react";
import type { DepartmentStage } from "@/lib/types";

interface Props {
  departmentId: string;
  departmentName: string;
  initialStages: DepartmentStage[];
}

export default function StagesEditor({ departmentId, initialStages }: Props) {
  const [stages, setStages] = useState(initialStages);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addStage() {
    const maxPos = Math.max(0, ...stages.map((s) => s.position));
    setStages((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        department_id: departmentId,
        name: "",
        position: maxPos + 1,
        is_terminal: false,
        color: "#71717a",
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function removeStage(id: string) {
    setStages((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStage(id: string, field: keyof DepartmentStage, value: string | boolean | number) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  async function saveStages() {
    setSaving(true);
    const supabase = createClient();

    // Delete removed stages (only existing ones, not new-*)
    const existingIds = initialStages.map((s) => s.id);
    const currentIds = stages.map((s) => s.id).filter((id) => !id.startsWith("new-"));
    const toDelete = existingIds.filter((id) => !currentIds.includes(id));
    if (toDelete.length > 0) {
      await supabase.from("department_stages").delete().in("id", toDelete);
    }

    // Upsert all current stages
    const upsertData = stages.map((s, i) => ({
      ...(s.id.startsWith("new-") ? {} : { id: s.id }),
      department_id: departmentId,
      name: s.name,
      position: i + 1,
      is_terminal: s.is_terminal,
      color: s.color ?? null,
    }));

    await supabase.from("department_stages").upsert(upsertData, { onConflict: "id" });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
          <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
          <Input
            value={stage.name}
            onChange={(e) => updateStage(stage.id, "name", e.target.value)}
            placeholder="Stage name"
            className="flex-1"
          />
          <input
            type="color"
            value={stage.color ?? "#71717a"}
            onChange={(e) => updateStage(stage.id, "color", e.target.value)}
            className="h-8 w-8 rounded cursor-pointer border border-gray-200"
            title="Stage color"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={stage.is_terminal}
              onChange={(e) => updateStage(stage.id, "is_terminal", e.target.checked)}
              className="rounded"
            />
            Final
          </label>
          <button
            onClick={() => removeStage(stage.id)}
            className="text-gray-300 hover:text-red-400 transition-colors"
            title="Remove stage"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addStage}>
          <Plus className="h-3.5 w-3.5" />
          Add stage
        </Button>
        <Button type="button" size="sm" onClick={saveStages} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle className="h-3.5 w-3.5" /> : null}
          {saved ? "Saved!" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
