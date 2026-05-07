import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function humanizeOAuthError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/database error saving new user/i.test(raw)) {
    return "Your Google account is not on the PPDMS access list, or your invited account is not yet active. Contact your administrator.";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  // Provider error (user canceled, consent denied, transient OAuth failure).
  // Usually send back to /auth — but GoTrue masks our invite trigger with
  // "Database error saving new user", which reads like a retry-able glitch.
  // Surface that case on /auth/not-authorized instead.
  if (oauthError) {
    const rawDesc = oauthErrorDescription ?? "";
    if (/database error saving new user/i.test(rawDesc)) {
      const reason = humanizeOAuthError(rawDesc);
      if (reason) {
        const denied = new URL("/auth/not-authorized", url.origin);
        denied.searchParams.set("reason", reason);
        return NextResponse.redirect(denied);
      }
    }
    const target = new URL("/auth", url.origin);
    target.searchParams.set(
      "reason",
      oauthErrorDescription || "Sign-in was interrupted. Please try again.",
    );
    return NextResponse.redirect(target);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth", url.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  // Code-exchange failure is almost always transient (PKCE verifier cookie
  // missing, code already consumed by a refresh, overlapping sign-in tabs).
  // Route back to /auth so the user retries — not /auth/not-authorized.
  if (exchangeError) {
    const rawMsg = exchangeError.message ?? "";
    if (/database error saving new user/i.test(rawMsg)) {
      const reason = humanizeOAuthError(rawMsg);
      if (reason) {
        const denied = new URL("/auth/not-authorized", url.origin);
        denied.searchParams.set("reason", reason);
        return NextResponse.redirect(denied);
      }
    }
    const target = new URL("/auth", url.origin);
    target.searchParams.set(
      "reason",
      exchangeError.message || "Sign-in session expired. Please try again.",
    );
    return NextResponse.redirect(target);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth", url.origin));
  }

  let { data: profile } = await supabase
    .schema("palaro")
    .from("profiles")
    .select("status, roles")
    .eq("auth_user_id", user.id)
    .single();

  // Self-heal: the DB INSERT trigger only links auth_user_id when auth.users
  // gets a new row. If this user's auth.users row pre-existed the trigger (or
  // came from another app on the same Supabase project), the link never
  // happened. Try to link an invited profile by email here, matching the
  // trigger's logic. Uses the service-role client because RLS does not allow
  // self-update of profiles.
  if (!profile && user.email) {
    const admin = createAdminClient();
    const { data: invited } = await admin
      .schema("palaro")
      .from("profiles")
      .select("id, status, roles, full_name, avatar_url")
      .eq("email", user.email)
      .is("auth_user_id", null)
      .eq("status", "active")
      .maybeSingle();

    if (invited && (invited.roles?.length ?? 0) > 0) {
      const meta = (user.user_metadata ?? {}) as {
        full_name?: string;
        avatar_url?: string;
      };
      const { error: linkError } = await admin
        .schema("palaro")
        .from("profiles")
        .update({
          auth_user_id: user.id,
          activated_at: new Date().toISOString(),
          full_name: invited.full_name ?? meta.full_name ?? null,
          avatar_url: invited.avatar_url ?? meta.avatar_url ?? null,
        })
        .eq("id", invited.id);

      if (!linkError) {
        profile = { status: invited.status, roles: invited.roles };
      }
    }
  }

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/auth/not-authorized", url.origin),
    );
  }

  if (profile.status === "suspended") {
    return NextResponse.redirect(new URL("/auth/suspended", url.origin));
  }

  if (profile.status !== "active" || (profile.roles?.length ?? 0) === 0) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/auth/not-authorized", url.origin),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
