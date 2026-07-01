import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { RevenueRangePicker } from "@/components/admin/revenue-range-picker";
import { getStaffAnalysis, type StaffStat } from "@/lib/data/staff-analysis";
import { resolveRevenueRange, revenueReportArg } from "@/lib/data/reports";
import { getActiveAdminStoreId } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { ShoppingBag, Coins, Activity, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}
function prettyAction(a: string) {
  return a.replace(/[._]/g, " ");
}

export default async function StaffAnalysisPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const resolved = resolveRevenueRange(searchParams);
  const storeId = await getActiveAdminStoreId();
  const a = await getStaffAnalysis(revenueReportArg(resolved), storeId);
  const activeStaff = a.staff.filter((s) => s.ordersCreated || s.activityCount || s.paymentsRecorded);
  const idleStaff = a.staff.filter((s) => !(s.ordersCreated || s.activityCount || s.paymentsRecorded));

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Staff Analysis" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Staff Analysis"
            subtitle={`Activity per staff member · ${fmtDay(a.from)} – ${fmtDay(a.to)}`}
            actions={
              <RevenueRangePicker
                basePath="/admin/staff-analysis"
                activeRange={resolved.isCustom ? null : resolved.presetRange}
                from={resolved.from}
                to={resolved.to}
              />
            }
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <Summary label="Orders by staff" value={String(a.totals.ordersCreated)} sub={`${a.totals.unitsSold} units`} icon={<ShoppingBag className="size-4 text-brand-primary" />} />
            <Summary label="Sales by staff" value={formatMoney(a.totals.salesKobo)} sub="POS + manual orders" icon={<Coins className="size-4 text-brand-accent" />} />
            <Summary label="Payments recorded" value={formatMoney(a.totals.paymentsKobo)} sub="collected by staff" icon={<Coins className="size-4 text-info" />} />
            <Summary label="Total activity" value={String(a.totals.activityCount)} sub={`${activeStaff.length} active staff`} icon={<Activity className="size-4 text-warning" />} />
          </div>

          {activeStaff.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-10 text-center text-fg-muted">
              <Users className="size-6 mx-auto mb-2" />
              No staff activity in this period yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3.5">
              {activeStaff.map((s) => (
                <StaffCard key={s.id} s={s} />
              ))}
            </div>
          )}

          {idleStaff.length > 0 && (
            <p className="text-xs text-fg-muted mt-4">
              No activity this period: {idleStaff.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Summary({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
        {icon}
      </div>
      <div className="text-2xl font-bold tracking-tight mt-1.5 tabular">{value}</div>
      <div className="text-[11px] text-fg-muted mt-0.5">{sub}</div>
    </div>
  );
}

function StaffCard({ s }: { s: StaffStat }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-9 rounded-full bg-gradient-to-br from-brand-primary to-brand-primary-hover flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {s.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{s.name}</div>
          <div className="text-[11px] text-fg-muted capitalize">
            {s.role.replace(/_/g, " ")}
            {!s.active && " · disabled"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Orders" value={String(s.ordersCreated)} sub={`${s.unitsSold}u`} />
        <Metric label="Sales" value={formatMoney(s.salesKobo)} />
        <Metric label="Payments" value={formatMoney(s.paymentsKobo)} sub={`${s.paymentsRecorded}×`} />
        <Metric label="Returns" value={String(s.returnsHandled)} />
        <Metric label="Expenses" value={formatMoney(s.expensesKobo)} sub={`${s.expensesLogged}×`} />
        <Metric label="Activity" value={String(s.activityCount)} sub="actions" />
      </div>

      {s.topActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {s.topActions.map((t) => (
            <span key={t.action} className="text-[11px] rounded-full bg-surface-2 text-fg-muted px-2 py-0.5">
              {prettyAction(t.action)} <span className="font-bold text-fg">{t.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-surface-2 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="text-sm font-bold tabular mt-0.5 truncate" title={value}>{value}</div>
      {sub && <div className="text-[10px] text-fg-subtle">{sub}</div>}
    </div>
  );
}
