"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Department, EmployeeRole } from "@/lib/types";
import { addEmployee } from "./actions";

export default function AddEmployeeDialog({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempLink, setTempLink] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "employee" as EmployeeRole,
    department_id: "",
    title: "",
  });

  const needsDept = ["manager", "employee"].includes(form.role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await addEmployee(form);
    if (result.error) { setError(result.error); setLoading(false); return; }
    setTempLink(result.link ?? null);
    setLoading(false);
    router.refresh();
  }

  if (tempLink) {
    return (
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTempLink(null); }}>
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" />Add Employee</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Employee added!</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Share this one-time login link with {form.full_name}:</p>
            <code className="block text-xs bg-gray-50 rounded p-3 break-all">{tempLink}</code>
            <Button onClick={() => { setOpen(false); setTempLink(null); setForm({ full_name: "", email: "", role: "employee", department_id: "", title: "" }); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />Add Employee</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as EmployeeRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as EmployeeRole[]).filter((r) => r !== "root").map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Videographer" />
            </div>
          </div>
          {needsDept && (
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !form.full_name || !form.email} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add & generate link
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
