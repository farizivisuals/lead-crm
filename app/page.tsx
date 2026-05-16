import { redirect } from "next/navigation";

// Middleware handles the redirect, but as a fallback:
export default function RootPage() {
  redirect("/login");
}
