export default function Home() {
  return (
    <main className="min-h-screen p-8 flex flex-col items-start gap-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-primary text-brand-primary-fg font-bold text-sm">
          av
        </span>
        <span className="text-2xl font-bold tracking-tight">mall</span>
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-tight max-w-2xl">
        Foundation scaffold ready.
      </h1>
      <p className="text-fg-muted max-w-prose">
        Phase 1 starts here. Design tokens are wired into Tailwind. Next step:
        build the core primitives — <code className="font-mono text-sm">Money</code>,{" "}
        <code className="font-mono text-sm">Button</code>,{" "}
        <code className="font-mono text-sm">Input</code>,{" "}
        <code className="font-mono text-sm">Badge</code>, and the rest.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-status-pending/10 text-status-pending px-3 py-1 text-xs font-semibold">
          <span className="size-1.5 rounded-full bg-current" /> Pending
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-status-confirmed/10 text-status-confirmed px-3 py-1 text-xs font-semibold">
          <span className="size-1.5 rounded-full bg-current" /> Confirmed
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-status-processing/10 text-status-processing px-3 py-1 text-xs font-semibold">
          <span className="size-1.5 rounded-full bg-current" /> Processing
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-status-shipped/10 text-status-shipped px-3 py-1 text-xs font-semibold">
          <span className="size-1.5 rounded-full bg-current" /> Shipped
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-status-delivered/10 text-status-delivered px-3 py-1 text-xs font-semibold">
          <span className="size-1.5 rounded-full bg-current" /> Delivered
        </span>
      </div>
      <p className="font-mono tabular text-sm text-fg-muted">
        ₦34,000 · ₦1,250,000 · #AVM-2841
      </p>
    </main>
  );
}
