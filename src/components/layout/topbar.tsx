import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/lib/auth/access-check";

interface TopbarProps {
  profile: Profile;
}

export function Topbar({ profile }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:px-6 print:hidden">
      <MobileNav role={profile.role} />
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell profileId={profile.id} role={profile.role} />
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
