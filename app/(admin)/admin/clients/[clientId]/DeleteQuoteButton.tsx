"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteQuote } from "./quoteActions";

export default function DeleteQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await deleteQuote(quoteId);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center gap-1 h-7 px-2 rounded-lg border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all duration-150"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="h-7 px-2 rounded-lg border bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 text-xs font-medium transition-all duration-150"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center justify-center h-7 w-7 rounded-lg border bg-white/[0.04] border-white/[0.08] text-white/20 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-150"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
