import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { Footer } from "@/components/layout/footer";

export default async function NotAuthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Access not authorized
            </CardTitle>
            <CardDescription>
              Your Google account is not on the Palaro Command access list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {params.reason ? (
              <Alert variant="destructive">
                <AlertDescription className="text-xs font-mono break-words">
                  {params.reason}
                </AlertDescription>
              </Alert>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Contact your administrator to request an invitation. Once invited,
              sign in again with the same Google account and you&rsquo;ll have
              instant access.
            </p>
            <SignOutLink redirectTo="/auth" label="Back to sign-in" />
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
