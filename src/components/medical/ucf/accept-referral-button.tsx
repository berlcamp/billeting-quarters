"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptReferral } from "@/lib/actions/referrals";

export function AcceptReferralButton({ referralId }: { referralId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handle() {
    setBusy(true);
    const result = await acceptReferral({ id: referralId });
    setBusy(false);
    if (result.error) {
      toast.error("Accept failed", { description: result.error });
      return;
    }
    toast.success("Referral accepted");
    router.refresh();
  }

  return (
    <Button onClick={handle} disabled={busy}>
      <CheckCircle2 className="size-4" />
      {busy ? "Accepting…" : "Accept referral"}
    </Button>
  );
}
