"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const NoiseTexture = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 255;
      data[i] = noise;
      data[i + 1] = noise;
      data[i + 2] = noise;
      data[i + 3] = 15;
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-50 pointer-events-none"
      style={{ mixBlendMode: "overlay" }}
    />
  );
};

const AbstractVisual = () => (
  <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.02]" />

    <motion.div
      className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-white/[0.06] to-white/[0.02] rounded-full blur-3xl"
      animate={{ scale: [1, 1.2, 1], x: [0, 40, 0], y: [0, 30, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-white/[0.04] to-white/[0.02] rounded-full blur-3xl"
      animate={{ scale: [1, 1.3, 1], x: [0, -40, 0], y: [0, -50, 0] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/[0.03] rounded-full blur-2xl"
      animate={{ scale: [1, 1.4, 1], rotate: [0, 180, 360] }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
    />

    {/* Decorative grid */}
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.04]"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }}
    />

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.5 }}
      className="text-center relative z-10 px-8"
    >
      <h1 className="text-7xl font-bold mb-4 text-white tracking-tighter">
        lead.
      </h1>
      <p className="text-white/40 text-base font-medium tracking-wide uppercase">
        Marketing Agency CRM
      </p>

      <div className="mt-12 flex flex-col gap-3 text-left max-w-xs mx-auto">
        {["Manage clients & projects", "Track team deliverables", "Collaborate in real-time"].map((text, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.15 }}
            className="flex items-center gap-3 text-white/40 text-sm"
          >
            <div className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
            {text}
          </motion.div>
        ))}
      </div>
    </motion.div>
  </div>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", data.user.id)
      .single();

    router.push(profile?.user_type === "client" ? "/portal" : "/admin/dashboard");
    router.refresh();
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full bg-[#06060a] relative overflow-hidden">
      <NoiseTexture />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.01]" />

      <div className="relative z-10 flex min-h-screen">
        {/* Left: abstract visual — hidden on mobile */}
        <div className="hidden lg:flex lg:w-1/2 relative border-r border-white/[0.06]">
          <AbstractVisual />
        </div>

        {/* Right: login form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-16">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm"
          >
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-10">
              <h1 className="text-5xl font-bold text-white tracking-tighter">lead.</h1>
              <p className="text-white/40 text-sm mt-1">Marketing Agency CRM</p>
            </div>

            <div className="relative backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent rounded-2xl pointer-events-none" />

              <div className="relative z-10">
                <div className="mb-8">
                  <motion.h2
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-white tracking-tight"
                  >
                    Welcome back
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-white/40 text-sm mt-1"
                  >
                    Sign in to your workspace
                  </motion.p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-1.5"
                  >
                    <label htmlFor="email" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 h-4 w-4 pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@agency.com"
                        required
                        autoComplete="email"
                        className="flex h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 pl-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-1.5"
                  >
                    <label htmlFor="password" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 h-4 w-4 pointer-events-none" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                        className="flex h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 pl-10 pr-11 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl"
                    >
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="pt-1"
                  >
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 rounded-xl bg-gradient-to-b from-white to-zinc-100 text-zinc-900 font-semibold text-sm shadow-lg shadow-white/10 hover:brightness-105 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 relative overflow-hidden group"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          <span className="relative z-10">Sign in</span>
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        </>
                      )}
                    </button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-center"
                  >
                    <a href="/reset-password" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                      Forgot your password?
                    </a>
                  </motion.div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
