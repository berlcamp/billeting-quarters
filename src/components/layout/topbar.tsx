import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/lib/auth/access-check";

interface TopbarProps {
  profile: Profile;
}

export function Topbar({ profile }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:px-6">
      <MobileNav role={profile.role} />
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <ThemeToggle />
        <UserMenu
          email={profile.email}
          fullName={profile.full_name}
          role={profile.role}
          avatarUrl={profile.avatar_url}
        />
      </div>
    </header>
  );
}
