"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Check, ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { createClientWithPortal } from "./actions";

interface Credentials { email: string; password: string; }

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | "both" | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    phone: "",
    notes: "",
  });

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createClientWithPortal(formData);
    if (result.error) { setError(result.error); setLoading(false); return; }
    setCreds({ email: result.email!, password: result.password! });
    setLoading(false);
  }

  function copy(field: "email" | "password" | "both") {
    if (!creds) return;
    const text = field === "both"
      ? `Email: ${creds.email}\nPassword: ${creds.password}`
      : field === "email" ? creds.email : creds.password;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (creds) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
        <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>

        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          <div className="px-5 py-5 border-b border-white/[0.07] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Client created!</p>
              <p className="text-xs text-white/40 mt-0.5">Send these credentials to {formData.contact_name}</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.09] divide-y divide-white/[0.06]">
              <div className="flex items-center justify-between px-3 py-3 gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-white/30 mb-0.5">Email</p>
                  <p className="text-xs text-white/80 font-mono truncate">{creds.email}</p>
                </div>
                <button onClick={() => copy("email")} className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                  {copiedField === "email" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between px-3 py-3 gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-white/30 mb-0.5">Password</p>
                  <p className="text-xs text-white/90 font-mono">{creds.password}</p>
                </div>
                <button onClick={() => copy("password")} className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                  {copiedField === "password" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-white/30 leading-relaxed">
              Share these login details with {formData.contact_name}. They can change their password after logging in from their portal.
            </p>

            <div className="flex gap-2">
              <Button onClick={() => copy("both")} variant={copiedField === "both" ? "secondary" : "default"} className="flex-1">
                {copiedField === "both" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedField === "both" ? "Copied!" : "Copy both"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/admin/clients")}>
                Go to clients
              </Button>
              <Button variant="ghost" onClick={() => { setCreds(null); setFormData({ company_name: "", contact_name: "", contact_email: "", phone: "", notes: "" }); }}>
                Add another
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
      <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </Link>

      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs text-indigo-400 font-medium uppercase tracking-widest">New Client</span>
          </div>
          <h2 className="font-semibold text-white">Add New Client</h2>
          <p className="text-xs text-white/40 mt-0.5">A portal account will be automatically created for the primary contact.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company name *</Label>
            <Input
              id="company_name"
              placeholder="Acme Corp"
              value={formData.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              required
            />
          </div>

          <div className="border-t border-white/[0.07] pt-4">
            <p className="text-sm font-medium text-white/70 mb-3">Primary contact (portal login)</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Full name *</Label>
                <Input
                  id="contact_name"
                  placeholder="Jane Smith"
                  value={formData.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="jane@acmecorp.com"
                  value={formData.contact_email}
                  onChange={(e) => updateField("contact_email", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 555 000 0000"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Internal notes about this client..."
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create client & generate credentials
          </Button>
        </form>
      </div>
    </div>
  );
}
