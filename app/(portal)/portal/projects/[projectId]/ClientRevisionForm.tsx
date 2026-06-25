"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, RotateCcw, Loader2 } from "lucide-react";

const REVISION_LIMIT = 2;

interface Props {
  deliverableId: string;
  actorProfileId: string;
  revisionsUsed: number;
}

export default function ClientRevisionForm({ deliverableId, actorProfileId, revisionsUsed }: Props) {
  const limitReached = revisionsUsed >= REVISION_LIMIT;
  const router = useRouter();
  const [action, setAction] = useState<"approve" | "request_revision" | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!action) return;
    if (action === "request_revision" && limitReached) {
      setError(`You only have ${REVISION_LIMIT} revisions. Please contact us for more.`);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rErr } = await supabase.from("deliverable_revisions").insert({
      deliverable_id: deliverableId,
      actor_profile_id: actorProfileId,
      action,
      note: note.trim() || null,
    });
    if (rErr) { setError(rErr.message); setLoading(false); return; }
    router.refresh();
  }

  if (action) {
    return (
      <div className="space-y-3 border-t border-gray-100 pt-3">
        <p className="text-sm font-medium text-gray-700">
          {action === "approve" ? "Confirm approval" : "Describe the changes needed"}
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={action === "approve" ? "Optional approval note..." : "Please describe what needs to change..."}
          rows={3}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button
            onClick={submit}
            disabled={loading || (action === "request_revision" && !note.trim())}
            variant={action === "approve" ? "default" : "destructive"}
            size="sm"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {action === "approve" ? "Approve" : "Request revision"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAction(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setAction("approve")} className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={limitReached}
          onClick={() => setAction("request_revision")}
          className="flex items-center gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Request revision
        </Button>
      </div>
      {limitReached && (
        <p className="text-xs text-white/50">
          You&apos;ve used both of your {REVISION_LIMIT} revisions. Need more changes? Contact us and we&apos;ll sort it out.
        </p>
      )}
    </div>
  );
}
