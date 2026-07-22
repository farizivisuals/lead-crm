"use client";
import { useState } from "react";
import { Link2, Check, Loader2, AlertCircle } from "lucide-react";

interface Props {
  getLink: () => Promise<{ message?: string; error?: string }>;
  label?: string;
}

export default function LoginLinkButton({ getLink, label = "Login link" }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    const result = await getLink();
    if (result.error || !result.message) {
      setState("error");
    } else {
      try {
        await navigator.clipboard.writeText(result.message);
        setState("copied");
      } catch {
        setState("error");
      }
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const icon =
    state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" />
    : state === "copied" ? <Check className="h-3 w-3 text-emerald-400" />
    : state === "error" ? <AlertCircle className="h-3 w-3 text-red-400" />
    : <Link2 className="h-3 w-3" />;

  const text =
    state === "copied" ? "Copied!"
    : state === "error" ? "Failed"
    : label;

  return (
    <button
      onClick={handleClick}
      title="Copy a welcome message with a one-time password-setup link"
      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all duration-150 bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.14]"
    >
      {icon}
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}
