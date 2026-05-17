"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpenDrawButton({ raffleId }: { raffleId: string }) {
  function openDraw() {
    window.open(`/raffle-draw/${raffleId}`, "_blank", "noopener,noreferrer");
  }
  return (
    <Button onClick={openDraw} className="gap-1.5">
      <Play className="size-4 fill-current" />
      Open Draw
    </Button>
  );
}
