import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Lead CRM",
  description: "How Lead CRM collects, uses, and protects your information.",
};

// TODO(owner): replace with the address you want published in the App Store
// listing and reachable by users. Do not ship the placeholder.
const CONTACT_EMAIL = "support@example.com";
const LAST_UPDATED = "12 August 2026";

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
        <p className="text-sm text-white/40">Last updated: {LAST_UPDATED}</p>
      </header>

      <Section title="Who this covers">
        <p>
          Lead CRM is a project-management platform for marketing agencies, available as a
          web application and an iOS app. This policy explains what we collect, why, and
          what control you have over it. It applies to both.
        </p>
        <p>
          Accounts are created for you by your organisation&apos;s administrator. You cannot
          sign up on your own, and the app has no public or anonymous mode.
        </p>
      </Section>

      <Section title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white/80">Account information.</strong> Your name, email
            address, and role, provided by your administrator when your account is created.
          </li>
          <li>
            <strong className="text-white/80">Content you enter.</strong> Clients, projects,
            tasks, deliverables, comments, dates, and file links you or your colleagues add
            while using the product.
          </li>
          <li>
            <strong className="text-white/80">Push notification tokens.</strong> If you allow
            notifications, we store a device token so we can deliver alerts about work
            assigned to you. You can revoke this in iOS Settings at any time.
          </li>
          <li>
            <strong className="text-white/80">Technical logs.</strong> Standard server logs
            from our hosting providers, including IP address and timestamps, kept for
            security and troubleshooting.
          </li>
        </ul>
        <p>
          We do not collect location data, contacts, photos, health data, or advertising
          identifiers. We do not use third-party analytics or advertising SDKs.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          Your information is used solely to operate the product: to authenticate you, to
          show you the work belonging to your organisation, to send notifications you have
          opted into, and to keep the service secure and working.
        </p>
        <p>
          We do not sell your information, share it with data brokers, or use it for
          advertising or cross-app tracking.
        </p>
      </Section>

      <Section title="Where it is stored">
        <p>
          Data is stored with Supabase, our database and authentication provider. Access is
          enforced at the database level, so you can only read the records belonging to your
          organisation and permitted by your role.
        </p>
        <p>
          Push notifications are delivered through Expo&apos;s notification service and
          Apple Push Notification service.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          We keep your account and its associated content for as long as your organisation
          maintains an account with us. Your administrator can deactivate your access at any
          time.
        </p>
        <p>
          To request a copy of your personal data or have it deleted, contact us at{" "}
          <a className="text-white underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . We will respond within 30 days. Note that content created as part of your
          organisation&apos;s business records may be retained by that organisation.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Lead CRM is a workplace tool and is not directed to children. We do not knowingly
          collect information from anyone under 16.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we make material changes to this policy we will update the date above and, where
          appropriate, notify you in the app.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or your data:{" "}
          <a className="text-white underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
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
