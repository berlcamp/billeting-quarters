import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { getCurrentUser } from "@/lib/auth/session";
import { Footer } from "@/components/layout/footer";

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Account suspended
            </CardTitle>
            <CardDescription>
              Your Palaro Command account has been suspended.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.email ? (
              <p className="text-sm text-muted-foreground text-center">
                Signed in as{" "}
                <span className="font-mono text-foreground">{user.email}</span>
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Contact your administrator if you believe this is in error.
            </p>
            <SignOutLink redirectTo="/auth" label="Sign out" />
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
