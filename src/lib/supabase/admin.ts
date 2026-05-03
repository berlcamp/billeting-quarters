import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client. Bypasses RLS — use ONLY in trusted server code
// (server actions, route handlers, scheduled jobs). NEVER import from a
// client component. The `server-only` import above will trip the build
// if anything client-side reaches this file.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
