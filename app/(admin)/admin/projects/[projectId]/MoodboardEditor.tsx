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

function toEmbedUrl(url: string): string {
  if (!url.includes("canva.com")) return url;
  return url.split("?")[0] + "?embed";
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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Canva
            </a>
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

      {url && !editing && (
        <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08]" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={toEmbedUrl(url)}
            className="absolute inset-0 w-full h-full"
            allow="fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}

      {!url && !editing && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] py-10">
          <LayoutTemplate className="h-8 w-8 text-white/20" />
          <p className="text-sm text-white/30">Paste a Canva link to embed the moodboard</p>
        </div>
      )}
    </div>
  );
}
