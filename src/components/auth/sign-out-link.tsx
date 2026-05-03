"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutLink({
  redirectTo = "/auth",
  label = "Sign out",
}: {
  redirectTo?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      disabled={loading}
      className="w-full"
    >
      {loading ? "Signing out…" : label}
    </Button>
  );
}
