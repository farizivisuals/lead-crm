"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteClient } from "../new/actions";

/** The clients area is executives-only (layout guard), so no role check here. */
export default function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Delete ${name}? This permanently removes the client, their projects, tasks, quotes and portal login. It can't be undone.`)) return;
    setLoading(true);
    setError(null);
    const result = await deleteClient(clientId);
    if (result.error) { setError(result.error); setLoading(false); return; }
    router.push("/admin/clients");
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={loading}
        className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Delete client
      </Button>
    </div>
  );
}
