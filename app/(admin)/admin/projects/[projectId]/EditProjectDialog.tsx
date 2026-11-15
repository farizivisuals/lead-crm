"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteProject, updateProjectDetails } from "./actions";

interface Props {
  projectId: string;
  initial: { name: string; description: string | null; start_date: string | null; target_end_date: string | null };
}

export default function EditProjectDialog({ projectId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(toForm(initial));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await updateProjectDetails(projectId, form);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${initial.name}"? This permanently removes the project with all its tasks, videos and deliverables. It can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    const res = await deleteProject(projectId);
    if (res.error) { setError(res.error); setDeleting(false); return; }
    router.push("/admin/projects");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) { setForm(toForm(initial)); setError(null); } // start from the saved values each time
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Project name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !form.name.trim()} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting || loading}
              title="Delete project"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toForm(p: Props["initial"]) {
  return {
    name: p.name,
    description: p.description ?? "",
    start_date: p.start_date ?? "",
    target_end_date: p.target_end_date ?? "",
  };
}
