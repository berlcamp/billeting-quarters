"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error("Sign-in failed", { description: error.message });
      setLoading(false);
    }
    // Otherwise the browser navigates away to Google.
  }

  return (
    <Button onClick={handleSignIn} disabled={loading} className="w-full">
      {loading ? "Redirecting…" : "Sign in with Google"}
    </Button>
  );
}
