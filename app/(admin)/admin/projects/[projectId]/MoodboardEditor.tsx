"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Pencil, X, Check, Loader2, LayoutTemplate } from "lucide-react";
import { updateMoodboardUrl } from "./actions";

interface Props {
  projectId: string;
  initialUrl: string | null;
}

export default function MoodboardEditor({ projectId, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateMoodboardUrl(projectId, draft.trim() || null);
      setUrl(draft.trim());
      setEditing(false);
    });
  }

  function handleCancel() {
    setDraft(url);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://www.canva.com/design/..."
            className="flex-1 font-mono text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={pending}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          {url ? (
            <Button asChild size="sm" className="gap-1.5">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Canva
              </a>
            </Button>
          ) : (
            <span className="text-sm text-white/30">No moodboard linked yet</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="gap-1.5 text-white/40 hover:text-white/80 flex-shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            {url ? "Edit link" : "Add link"}
          </Button>
        </div>
      )}

      {!url && !editing && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] py-10">
          <LayoutTemplate className="h-8 w-8 text-white/20" />
          <p className="text-sm text-white/30">Paste a Canva link to the moodboard</p>
        </div>
      )}
    </div>
  );
}
