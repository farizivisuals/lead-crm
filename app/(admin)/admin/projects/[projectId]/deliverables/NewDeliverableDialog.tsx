"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

interface Props {
  projectId: string;
  tasks: { id: string; title: string }[];
}

export default function NewDeliverableDialog({ projectId, tasks }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    type: "video" as "video" | "photo" | "pr",
    dropbox_url: "",
    thumbnail_url: "",
    task_id: "",
    status: "draft" as const,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: dErr } = await supabase.from("deliverables").insert({
      project_id: projectId,
      task_id: form.task_id || null,
      type: form.type,
      title: form.title,
      dropbox_url: form.dropbox_url,
      thumbnail_url: form.thumbnail_url || null,
      status: form.status,
      submitted_by: user?.id,
    });

    if (dErr) { setError(dErr.message); setLoading(false); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Deliverable
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Deliverable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brand video – final cut"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as typeof form.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="pr">PR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as typeof form.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="internal_review">Internal Review</SelectItem>
                  <SelectItem value="client_review">Client Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dropbox link *</Label>
            <Input
              type="url"
              value={form.dropbox_url}
              onChange={(e) => setForm((f) => ({ ...f, dropbox_url: e.target.value }))}
              placeholder="https://www.dropbox.com/sh/..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Thumbnail URL <span className="text-gray-400">(optional)</span></Label>
            <Input
              type="url"
              value={form.thumbnail_url}
              onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          {tasks.length > 0 && (
            <div className="space-y-2">
              <Label>Link to task <span className="text-gray-400">(optional)</span></Label>
              <Select value={form.task_id} onValueChange={(v) => setForm((f) => ({ ...f, task_id: v }))}>
                <SelectTrigger><SelectValue placeholder="No task" /></SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !form.title || !form.dropbox_url} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add deliverable
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
