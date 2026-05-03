import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PROTECTED_PREFIXES = ["/dashboard"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Touching getUser() refreshes the session cookie when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // The /auth/* tree (login, callback, suspended, not-authorized) is always
  // reachable — including by suspended users so they can sign out.
  if (pathname.startsWith("/auth")) {
    return response;
  }

  // Unauthenticated visitors can browse public marketing-style routes, but
  // hitting any protected app route bounces them to /auth.
  if (!user) {
    if (isProtectedPath(pathname)) {
      const target = new URL("/auth", request.url);
      return NextResponse.redirect(target);
    }
    return response;
  }

  // Authenticated — verify the profile is active and roled.
  const { data: profile } = await supabase
    .schema("palaro")
    .from("profiles")
    .select("status, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/not-authorized", request.url));
  }

  if (profile.status === "suspended") {
    return NextResponse.redirect(new URL("/auth/suspended", request.url));
  }

  if (profile.status !== "active" || !profile.role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/not-authorized", request.url));
  }

  return response;
}
