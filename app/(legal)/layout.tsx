import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Chrome for the publicly reachable legal/support pages. These sit outside the
 * admin and portal shells on purpose — they must render for signed-out
 * visitors, including the App Store reviewer.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08090d] text-white/90">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/login" className="text-sm font-semibold tracking-tight">
            Lead CRM
          </Link>
          <nav className="flex gap-5 text-sm text-white/50">
            <Link href="/privacy" className="hover:text-white/80">
              Privacy
            </Link>
            <Link href="/support" className="hover:text-white/80">
              Support
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-white/35">
          © {new Date().getFullYear()} Lead CRM
        </div>
      </footer>
    </div>
  );
}
