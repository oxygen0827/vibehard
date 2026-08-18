import { AppNav } from "@/components/app/app-nav";
import { AppSidebar } from "@/components/app/app-sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-14rem] h-[42rem] w-[68rem] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[150px]" />
        <div className="auth-grid absolute inset-0 opacity-[0.16] dark:opacity-25" />
      </div>

      <div className="relative z-10 flex h-screen flex-col">
        <AppNav />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </main>
  );
}
