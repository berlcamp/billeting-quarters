import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { RaffleFormDialog } from "@/components/raffle/raffle-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getRaffles } from "@/lib/actions/raffle";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatDistanceToNowStrict } from "date-fns";

export default async function RaffleListPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "raffle.view")) return <Forbidden />;
  const canManage = hasPermission(profile, "raffle.manage");

  const result = await getRaffles();
  const raffles = result.error ? [] : result.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raffle"
        description="Run electronic raffle draws. Create a raffle, add departments and entries, then open the Draw page to spin."
        actions={canManage ? <RaffleFormDialog /> : null}
      />

      {result.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load raffles: {result.error}
        </div>
      ) : raffles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Sparkles className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="font-semibold">No raffles yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first raffle to start adding departments and entries.
              </p>
            </div>
            {canManage ? <RaffleFormDialog /> : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {raffles.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2">{r.name}</span>
                  <Sparkles className="size-4 shrink-0 text-amber-500" />
                </CardTitle>
                {r.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2 pt-0">
                <span className="text-xs text-muted-foreground">
                  Created {formatDistanceToNowStrict(new Date(r.created_at))} ago
                </span>
                <Link
                  href={`/dashboard/raffle/${r.id}`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Open
                  <ArrowRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
