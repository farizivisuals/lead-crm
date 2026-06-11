"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Loader2, ChevronsUp } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

interface Props {
  deliverable: {
    id: string;
    title: string;
    type: string;
    dropbox_url: string;
    thumbnail_url: string | null;
    status: string;
    version: number;
  };
}

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "internal_review", label: "Internal Review" },
  { value: "client_review", label: "Client Review" },
  { value: "approved", label: "Approved" },
  { value: "revision_requested", label: "Revision Requested" },
];

export default function EditDeliverableDialog({ deliverable }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: deliverable.title,
    dropbox_url: deliverable.dropbox_url,
    thumbnail_url: deliverable.thumbnail_url ?? "",
    status: deliverable.status,
    version: deliverable.version,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: err } = await supabase
      .from("deliverables")
      .update({
        title: form.title,
        dropbox_url: form.dropbox_url,
        thumbnail_url: form.thumbnail_url || null,
        status: form.status,
        version: form.version,
      })
      .eq("id", deliverable.id);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  function handleOpen(val: boolean) {
    if (val) {
      setForm({
        title: deliverable.title,
        dropbox_url: deliverable.dropbox_url,
        thumbnail_url: deliverable.thumbnail_url ?? "",
        status: deliverable.status,
        version: deliverable.version,
      });
      setError(null);
    }
    setOpen(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Edit deliverable"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Deliverable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dropbox link *</Label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, version: f.version + 1 }))}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <ChevronsUp className="h-3.5 w-3.5" />
                v{form.version} → v{form.version + 1}
              </button>
            </div>
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

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={loading || !form.title || !form.dropbox_url}
              className="flex-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.version !== deliverable.version ? `Save as v${form.version}` : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
