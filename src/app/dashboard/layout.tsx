import { requireActiveProfile } from "@/lib/auth/session";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireActiveProfile();

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col print:hidden">
        <SidebarNav roles={profile.roles} />
      </aside>
      <div className="flex flex-1 flex-col min-w-0 print:block print:h-auto">
        <Topbar profile={profile} />
        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible print:h-auto">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
