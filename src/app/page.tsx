import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/auth/access-check";

export default async function Home() {
  const access = await checkAccess();
  switch (access.status) {
    case "authorized":
      redirect("/dashboard");
    case "suspended":
      redirect("/auth/suspended");
    case "not_authorized":
      redirect("/auth/not-authorized");
    case "unauthenticated":
      redirect("/auth");
  }
}
