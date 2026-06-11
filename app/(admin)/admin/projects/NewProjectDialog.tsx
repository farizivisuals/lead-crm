"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Department } from "@/lib/types";

interface Props {
  clients: { id: string; company_name: string }[];
  departments: Department[];
  creatives: { profile_id: string; full_name: string }[];
}

export default function NewProjectDialog({ clients, departments, creatives }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([]);

  const [form, setForm] = useState({
    client_id: "",
    name: "",
    description: "",
    status: "planning",
    start_date: "",
    target_end_date: "",
  });

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function toggleCreative(id: string) {
    setSelectedCreatives((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDepts.length === 0) { setError("Select at least one department"); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({
        ...form,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
        owner_profile_id: user?.id,
        created_by: user?.id,
      })
      .select()
      .single();

    if (pErr) { setError(pErr.message); setLoading(false); return; }

    await supabase.from("project_departments").insert(
      selectedDepts.map((dept_id, i) => ({
        project_id: project.id,
        department_id: dept_id,
        is_primary: i === 0,
      }))
    );

    if (selectedCreatives.length > 0) {
      await supabase.from("project_creatives").insert(
        selectedCreatives.map((profile_id) => ({
          project_id: project.id,
          profile_id,
        }))
      );
    }

    setOpen(false);
    router.push(`/admin/projects/${project.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Project name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Brand Campaign Q3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Departments *</Label>
            <div className="flex gap-2 flex-wrap">
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDept(d.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selectedDepts.includes(d.id)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {creatives.length > 0 && (
            <div className="space-y-2">
              <Label>Creatives</Label>
              <div className="flex gap-2 flex-wrap">
                {creatives.map((c) => (
                  <button
                    key={c.profile_id}
                    type="button"
                    onClick={() => toggleCreative(c.profile_id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                      selectedCreatives.includes(c.profile_id)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {c.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Target end</Label>
              <Input
                type="date"
                value={form.target_end_date}
                onChange={(e) => setForm((f) => ({ ...f, target_end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !form.client_id || !form.name} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create project
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
