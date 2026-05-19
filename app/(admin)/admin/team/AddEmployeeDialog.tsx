"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Copy, Check, UserPlus } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Department, EmployeeRole } from "@/lib/types";
import { addEmployee } from "./actions";

export default function AddEmployeeDialog({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempLink, setTempLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  function copyLink() {
    if (!tempLink) return;
    navigator.clipboard.writeText(tempLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setTempLink(null);
    setCopied(false);
    setForm({ full_name: "", email: "", role: "employee", department_id: "", title: "" });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />Add Employee</Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        {tempLink ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <DialogTitle>Employee added!</DialogTitle>
                  <p className="text-xs text-white/40 mt-0.5">Share the login link with {form.full_name}</p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.09] p-3 space-y-2">
                <p className="text-xs text-white/40 font-medium">One-time login link</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-white/80 font-mono break-all flex-1 leading-relaxed select-all">
                    {tempLink}
                  </p>
                  <button
                    onClick={copyLink}
                    className={`flex-shrink-0 p-2 rounded-lg border transition-all duration-150 ${
                      copied
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : "bg-white/[0.06] border-white/[0.1] text-white/50 hover:text-white hover:bg-white/[0.1]"
                    }`}
                    title="Copy link"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-white/30 leading-relaxed">
                This link lets {form.full_name} set their password and log in. It expires after first use.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={copyLink}
                  variant={copied ? "secondary" : "default"}
                  className="flex-1"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
                  Done
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
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
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || !form.full_name || !form.email} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add & generate link
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
