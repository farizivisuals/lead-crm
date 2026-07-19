import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LOGIN_URL = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

// POST-only: signing out is a state change, so a GET here would let any
// embedded resource (e.g. <img src>) log the user out (logout CSRF).
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.redirect(LOGIN_URL, { status: 302 });
}
