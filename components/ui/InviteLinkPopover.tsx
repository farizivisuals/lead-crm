"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Copy, Check, Loader2, X, RefreshCw } from "lucide-react";

interface Credentials { email: string; password: string; }

interface Props {
  getCredentials: () => Promise<{ email?: string; password?: string; error?: string }>;
  label?: string;
}

export default function CredentialsPopover({ getCredentials, label = "Reset password" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | "both" | null>(null);
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
    setLoading(true);
    setError(null);
    setCreds(null);
    const result = await getCredentials();
    if (result.error) {
      setError(result.error);
    } else {
      setCreds({ email: result.email!, password: result.password! });
    }
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
        <RefreshCw className="h-3 w-3" />
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
                <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-white/80">New credentials</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              {loading && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  <span className="text-xs text-white/40">Generating password…</span>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-2 rounded-lg">
                  {error}
                </p>
              )}

              {creds && (
                <>
                  <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.06]">
                    <div className="flex items-center justify-between px-2.5 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/30 mb-0.5">Email</p>
                        <p className="text-[11px] text-white/70 font-mono truncate">{creds.email}</p>
                      </div>
                      <button onClick={() => copy("email")} className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                        {copiedField === "email" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/30 mb-0.5">Password</p>
                        <p className="text-[11px] text-white/80 font-mono">{creds.password}</p>
                      </div>
                      <button onClick={() => copy("password")} className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                        {copiedField === "password" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    Previous password is now invalid. Share these credentials with the user.
                  </p>
                  <button
                    onClick={() => copy("both")}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all duration-150 ${
                      copiedField === "both"
                        ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                        : "bg-indigo-500/15 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20"
                    }`}
                  >
                    {copiedField === "both" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedField === "both" ? "Copied!" : "Copy both"}
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
