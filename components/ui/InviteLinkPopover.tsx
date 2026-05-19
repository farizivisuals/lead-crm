"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Copy, Check, Loader2, X } from "lucide-react";

interface Props {
  getLink: () => Promise<{ link?: string; error?: string }>;
  label?: string;
}

export default function InviteLinkPopover({ getLink, label = "Get login link" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (link) return; // already fetched
    setLoading(true);
    setError(null);
    const result = await getLink();
    if (result.error) { setError(result.error); } else { setLink(result.link ?? null); }
    setLoading(false);
  }

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        title={label}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
          open
            ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
            : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.14]"
        }`}
      >
        <Link2 className="h-3 w-3" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 mt-1.5 w-72 z-50 rounded-xl bg-[#0e0e16]/98 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/60 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-white/80">Login link</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              {loading && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  <span className="text-xs text-white/40">Generating link…</span>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-2 rounded-lg">
                  {error}
                </p>
              )}

              {link && (
                <>
                  <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2.5">
                    <p className="text-[11px] text-white/70 font-mono break-all leading-relaxed select-all">
                      {link}
                    </p>
                  </div>
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    One-time use — each click regenerates a fresh link and invalidates the previous one.
                  </p>
                  <button
                    onClick={copy}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all duration-150 ${
                      copied
                        ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                        : "bg-indigo-500/15 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20"
                    }`}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
