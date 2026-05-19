"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Loader2, AlertCircle } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const next = searchParams.get("next") ?? "/";
    const code = searchParams.get("code");

    async function handleCallback() {
      // PKCE flow — code in query string
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setError("This link has expired or is invalid."); return; }
        router.replace(next);
        return;
      }

      // Implicit flow — session tokens in URL hash (admin-generated links)
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) { setError("This link has expired or is invalid."); return; }
        router.replace(next);
        return;
      }

      setError("This link has expired or is invalid.");
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-white/60 text-sm">{error}</p>
          <a
            href="/login"
            className="inline-block text-indigo-400 text-sm hover:text-indigo-300 underline underline-offset-4"
          >
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
  </div>
);

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  );
}
