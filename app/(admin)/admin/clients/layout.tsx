import { requireExecutive } from "@/lib/auth/guards";

// Client management (list, detail, create) is restricted to the executive tier.
export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await requireExecutive();
  return <>{children}</>;
}
