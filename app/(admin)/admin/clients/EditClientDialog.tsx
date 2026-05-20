"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Loader2, Check } from "lucide-react";
import { getClientContactEmail, updateClient } from "./new/actions";

interface Props {
  clientId: string;
  initialData: {
    company_name: string;
    phone: string | null;
    notes: string | null;
    contact_name: string;
  };
}

export default function EditClientDialog({ clientId, initialData }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingEmail, setFetchingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [emailFetched, setEmailFetched] = useState(false);
  const [form, setForm] = useState({
    company_name: initialData.company_name,
    phone: initialData.phone ?? "",
    notes: initialData.notes ?? "",
    contact_name: initialData.contact_name,
    contact_email: "",
  });

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !emailFetched) {
      setFetchingEmail(true);
      const result = await getClientContactEmail(clientId);
      if (!result.error) {
        setForm((f) => ({ ...f, contact_email: result.email! }));
        setEmailFetched(true);
      }
      setFetchingEmail(false);
    }
    if (!isOpen) {
      setError(null);
      setSaved(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await updateClient(clientId, form);
    if (result.error) { setError(result.error); setLoading(false); return; }
    setSaved(true);
    setLoading(false);
    router.refresh();
    setTimeout(() => { setOpen(false); setSaved(false); }, 1200);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          title="Edit client"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.14] text-xs font-medium transition-all duration-150"
        >
          <Pencil className="h-3 w-3" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Company name *</Label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              required
            />
          </div>

          <div className="border-t border-white/[0.07] pt-3">
            <p className="text-sm font-medium text-white/50 mb-3">Primary contact</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Contact name *</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact email *</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  placeholder={fetchingEmail ? "Loading…" : ""}
                  disabled={fetchingEmail}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555 000 0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Internal notes about this client…"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={loading || fetchingEmail || !form.company_name || !form.contact_name || !form.contact_email}
              className="flex-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved && <Check className="h-4 w-4 text-emerald-400" />}
              {saved ? "Saved!" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
