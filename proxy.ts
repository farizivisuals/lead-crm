import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Public / auth-utility routes — always pass through
  if (pathname.startsWith("/api/auth/signout")) {
    return supabaseResponse;
  }

  // Public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/reset-password")) {
    if (user) {
      // Already logged in — redirect to correct home
      const profile = await getProfile(supabase, user.id);
      const dest = profile?.user_type === "client" ? "/portal" : "/admin/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return supabaseResponse;
  }

  // Require auth for everything else
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Cross-area guards
  if (pathname.startsWith("/admin") && profile.user_type !== "employee") {
    return NextResponse.redirect(new URL("/portal", request.url));
  }
  if (pathname.startsWith("/portal") && profile.user_type !== "client") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // Root → admin/dashboard by default
  if (pathname === "/") {
    const dest = profile.user_type === "client" ? "/portal" : "/admin/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}

async function getProfile(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .single();
  return data;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
