import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { checkAccess } from "@/lib/auth/access-check";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  // If the visitor is already signed in and authorized, send them onward.
  const access = await checkAccess();
  if (access.status === "authorized") redirect("/dashboard");
  if (access.status === "suspended") redirect("/auth/suspended");

  const params = await searchParams;
  const errorMessage =
    params.reason ||
    (params.error ? "Sign-in failed. Please try again." : null);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Palaro Command
          </CardTitle>
          <CardDescription>
            Palarong Pambansa Operations Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <GoogleSignInButton />
          <p className="text-center text-xs text-muted-foreground">
            Access is invitation-only. Contact your administrator if you need an
            account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
