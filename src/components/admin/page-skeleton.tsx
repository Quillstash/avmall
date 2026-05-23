import { Skeleton } from "@/components/ui/skeleton";
import { AdminTopBar } from "@/components/admin/topbar";

type Variant = "list" | "detail" | "form" | "dashboard";

/**
 * Instant Suspense fallback for admin route navigation. Admin pages are
 * force-dynamic, so without this the screen freezes on the old page until the
 * server data lands — making nav buttons feel dead. Rendering the real
 * AdminTopBar keeps the hamburger + breadcrumb live while the body loads.
 */
export function AdminPageSkeleton({
  variant = "list",
  title,
}: {
  variant?: Variant;
  title?: string;
}) {
  return (
    <>
      <AdminTopBar breadcrumbs={title ? [{ label: title }] : []} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>

          {variant === "dashboard" && <DashboardBody />}
          {variant === "list" && <ListBody />}
          {variant === "detail" && <DetailBody />}
          {variant === "form" && <FormBody />}
        </div>
      </div>
    </>
  );
}

function DashboardBody() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-3.5 mb-5">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="grid lg:grid-cols-[1fr_1.7fr] gap-3.5">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </>
  );
}

function ListBody() {
  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Filter bar */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBody() {
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-5">
      <div className="space-y-5">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

function FormBody() {
  return (
    <div className="max-w-2xl space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-10 w-40 rounded-md" />
    </div>
  );
}
