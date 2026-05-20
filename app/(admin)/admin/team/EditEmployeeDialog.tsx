"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Loader2, Check } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Department, EmployeeRole } from "@/lib/types";
import { getEmployeeEmail, updateEmployee } from "./actions";

interface Props {
  profileId: string;
  initialData: {
    full_name: string;
    role: EmployeeRole;
    department_id: string | null;
    title: string | null;
  };
  departments: Department[];
}

export default function EditEmployeeDialog({ profileId, initialData, departments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingEmail, setFetchingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    full_name: initialData.full_name,
    email: "",
    role: initialData.role,
    department_id: initialData.department_id ?? "",
    title: initialData.title ?? "",
  });

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !form.email) {
      setFetchingEmail(true);
      const result = await getEmployeeEmail(profileId);
      if (!result.error) setForm((f) => ({ ...f, email: result.email! }));
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
    const result = await updateEmployee(profileId, form);
    if (result.error) { setError(result.error); setLoading(false); return; }
    setSaved(true);
    setLoading(false);
    router.refresh();
    setTimeout(() => { setOpen(false); setSaved(false); }, 1200);
  }

  const needsDept = ["manager", "employee"].includes(form.role);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          title="Edit employee"
          className="flex items-center justify-center h-7 w-7 rounded-lg border bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.14] transition-all duration-150"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder={fetchingEmail ? "Loading…" : ""}
              disabled={fetchingEmail}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as EmployeeRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as EmployeeRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Videographer"
              />
            </div>
          </div>

          {needsDept && (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={loading || fetchingEmail || !form.full_name || !form.email}
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
