import { ShieldAlert } from "lucide-react";

interface ForbiddenProps {
  message?: string;
}

export function Forbidden({
  message = "You don't have permission to view this page.",
}: ForbiddenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
