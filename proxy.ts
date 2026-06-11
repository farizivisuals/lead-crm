import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The proxy only does fast, optimistic auth checks (local JWT verification —
// no network round trips). Real authorization lives in Postgres RLS, and the
// (admin)/(portal) layouts enforce user_type with verified server-side data.
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

  const { data } = await supabase.auth.getClaims();
  const isAuthed = !!data?.claims;
  const pathname = request.nextUrl.pathname;

  // Public / auth-utility routes — always pass through
  if (pathname.startsWith("/api/auth/signout")) {
    return supabaseResponse;
  }

  // Public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/reset-password")) {
    if (isAuthed) {
      // Clients get bounced to /portal by the admin layout
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Require auth for everything else
  if (!isAuthed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Root → admin/dashboard by default (admin layout redirects clients to /portal)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
