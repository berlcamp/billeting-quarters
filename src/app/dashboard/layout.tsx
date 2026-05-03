import { requireActiveProfile } from "@/lib/auth/session";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireActiveProfile();

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:flex lg:flex-col">
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={profile.role} />
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
