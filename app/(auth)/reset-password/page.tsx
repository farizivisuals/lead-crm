"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Zap, Mail, ArrowLeft, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (err) setError(err.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)", animation: "float 8s ease-in-out infinite" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)", animation: "float 10s ease-in-out infinite reverse" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.1] border border-white/[0.2] mb-5 shadow-2xl shadow-black/40">
            <Zap className="h-7 w-7 text-white" />
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.1] bg-white/[0.05] backdrop-blur-2xl p-8 shadow-2xl shadow-black/40">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">Check your inbox</p>
                <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
                  A reset link has been sent to <span className="text-white/80 font-medium">{email}</span>
                </p>
              </div>
              <a href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5 mt-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-1.5">Reset password</h2>
              <p className="text-sm text-white/40 mb-6">Enter your email and we&apos;ll send you a reset link</p>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@agency.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-9"
                    />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-white to-zinc-100 text-zinc-900 font-medium text-sm shadow-md shadow-black/30 hover:brightness-105 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <div className="text-center">
                  <a href="/login" className="text-sm text-white/30 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </a>
                </div>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
