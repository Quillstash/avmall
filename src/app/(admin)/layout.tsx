import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/ui/command-palette";

// Admin is auth-gated and always reads live data — never prerender.
export const dynamic = "force-dynamic";

export default function AdminRouteGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex bg-bg overflow-hidden print:h-auto print:overflow-visible print:block">
      <div className="print:hidden contents">
        <AdminSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 print:block print:flex-none">
        {children}
      </div>
      <div className="print:hidden contents">
        <CommandPalette />
        <Toaster />
      </div>
    </div>
  );
}
