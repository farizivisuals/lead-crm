"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { createQuote } from "./quoteActions";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

interface Props {
  clientId: string;
  clientName: string;
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "" };
}

export default function QuoteDialog({ clientId, clientName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLineItem()]);

  function resetForm() {
    setTitle("");
    setValidUntil("");
    setNotes("");
    setItems([newLineItem()]);
    setError(null);
  }

  function updateItem(id: string, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.some((item) => !item.description.trim())) {
      setError("All line items need a description.");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await createQuote({
      clientId,
      title: title.trim(),
      valid_until: validUntil || null,
      notes: notes.trim() || null,
      line_items: items.map((item, i) => ({
        description: item.description.trim(),
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        position: i,
      })),
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    resetForm();
    window.open(`/print/quotes/${result.quoteId}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.14] text-xs font-medium transition-all duration-150">
          <FileText className="h-3 w-3" />
          <span className="hidden sm:inline">Generate Quote</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Quote — {clientName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Quote title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Social Media Management Package"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Valid until</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, newLineItem()])}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add item
              </button>
            </div>

            <div className="rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_100px_32px] gap-0 text-xs text-white/30 font-medium px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span />
              </div>

              <div className="divide-y divide-white/[0.05]">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center px-3 py-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Service description"
                      className="h-8 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-white/20"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      className="h-8 text-sm text-right border-0 bg-transparent p-0 focus-visible:ring-0"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, "unit_price", e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-sm text-right border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="flex items-center justify-center h-8 w-8 text-white/20 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-4 px-3 py-2.5 border-t border-white/[0.08] bg-white/[0.02]">
                <span className="text-xs text-white/40">Total</span>
                <span className="text-sm font-semibold text-white">
                  KD {subtotal.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes / payment terms</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Payment due 30 days after acceptance. 50% deposit required to begin."
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !title.trim()} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Generating…" : "Generate PDF"}
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
