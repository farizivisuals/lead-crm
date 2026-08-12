import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support – Lead CRM",
  description: "Get help with Lead CRM.",
};

// TODO(owner): replace with the address you want published in the App Store
// listing and reachable by users. Do not ship the placeholder.
const CONTACT_EMAIL = "support@example.com";

export default function SupportPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Support</h1>
        <p className="text-sm text-white/50">
          We aim to reply to every request within one business day.
        </p>
      </header>

      <Section title="Contact us">
        <p>
          Email{" "}
          <a className="text-white underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . To help us resolve things quickly, include your account email, the screen you
          were on, and what you expected to happen.
        </p>
      </Section>

      <Section title="I can't sign in">
        <p>
          Use the <strong className="text-white/80">Forgot password</strong> link on the sign-in
          screen to receive a reset email. If no email arrives within a few minutes, check
          your spam folder, then contact us.
        </p>
        <p>
          Accounts are created by your organisation&apos;s administrator — there is no public
          sign-up. If you don&apos;t have an account yet, ask your administrator to add you.
        </p>
      </Section>

      <Section title="I'm not receiving notifications">
        <p>
          Open iOS Settings → Notifications → Lead CRM and confirm notifications are allowed.
          If you declined the permission prompt when you first opened the app, you&apos;ll need
          to re-enable it there.
        </p>
      </Section>

      <Section title="Deleting your account or data">
        <p>
          Contact us at{" "}
          <a className="text-white underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          and we will action the request within 30 days. See the{" "}
          <Link className="text-white underline underline-offset-4" href="/privacy">
            Privacy Policy
          </Link>{" "}
          for details on what we store.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/60">{children}</div>
    </section>
  );
}
