import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LOGIN_URL = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001");

export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(LOGIN_URL, { status: 302 });
}

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(LOGIN_URL, { status: 302 });
}
