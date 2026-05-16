"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClientWithPortal } from "./actions";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setPortalLink(result.link ?? null);
    setLoading(false);
  }

  function copyLink() {
    if (portalLink) {
      navigator.clipboard.writeText(portalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (portalLink) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <CardTitle>Client created!</CardTitle>
                <CardDescription>Share this one-time login link with {formData.contact_name}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">Portal access link (one-time use)</p>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-white border border-gray-200 rounded px-2 py-1 flex-1 truncate">
                  {portalLink}
                </code>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              The client will use this link to set their password and access their portal. The link expires after use.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/admin/clients")}>Go to clients</Button>
              <Button variant="outline" onClick={() => { setPortalLink(null); setFormData({ company_name: "", contact_name: "", contact_email: "", phone: "", notes: "" }); }}>
                Add another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add New Client</CardTitle>
          <CardDescription>
            A portal account will be automatically created for the client contact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Primary contact (portal login)</p>
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
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create client & generate portal link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
