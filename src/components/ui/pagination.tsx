"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /** Current 1-indexed page. */
  page: number;
  /** Total item count. */
  total: number;
  /** Page size. */
  perPage: number;
  onChange: (page: number) => void;
  /** Total surface to show (e.g. "Showing 1–10 of 284 orders"). */
  label?: string;
  /**
   * Rows-per-page choices. Pass together with `onPerPageChange` to show the
   * selector — server-paginated lists own the value (usually via a URL param),
   * so this component only reports the change.
   */
  perPageOptions?: number[];
  onPerPageChange?: (perPage: number) => void;
  className?: string;
}

export function Pagination({
  page,
  total,
  perPage,
  onChange,
  label,
  perPageOptions,
  onPerPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const showPerPage = !!perPageOptions?.length && !!onPerPageChange;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 flex-wrap text-xs text-fg-muted",
        className,
      )}
    >
      <span>
        {label ?? (
          <>
            Showing <span className="font-semibold text-fg tabular">{start}–{end}</span> of{" "}
            <span className="font-semibold text-fg tabular">{total}</span>
          </>
        )}
      </span>
      <div className="flex items-center gap-1">
        {showPerPage && (
          <label className="flex items-center gap-1.5 mr-2">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="h-8 rounded-md border border-border-strong bg-surface px-2 text-xs font-semibold text-fg outline-none focus:ring-2 focus:ring-brand-primary/30"
              aria-label="Rows per page"
            >
              {perPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <PageButton
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </PageButton>
        <NumberStrip page={page} totalPages={totalPages} onChange={onChange} />
        <PageButton
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-3.5" />
        </PageButton>
      </div>
    </div>
  );
}

function NumberStrip({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  if (totalPages <= 7) {
    return (
      <>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <PageNum key={n} n={n} active={n === page} onClick={() => onChange(n)} />
        ))}
      </>
    );
  }

  // 1 … current-1 current current+1 … last
  const showAround = [page - 1, page, page + 1].filter((n) => n >= 2 && n <= totalPages - 1);
  const showStart = !showAround.includes(2);
  const showEnd = !showAround.includes(totalPages - 1);

  return (
    <>
      <PageNum n={1} active={page === 1} onClick={() => onChange(1)} />
      {showStart && <Ellipsis />}
      {showAround.map((n) => (
        <PageNum key={n} n={n} active={n === page} onClick={() => onChange(n)} />
      ))}
      {showEnd && <Ellipsis />}
      <PageNum
        n={totalPages}
        active={page === totalPages}
        onClick={() => onChange(totalPages)}
      />
    </>
  );
}

function PageNum({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center min-w-8 h-8 px-2 text-xs font-semibold rounded-md tabular",
        active
          ? "bg-brand-primary text-brand-primary-fg"
          : "bg-surface hover:bg-surface-2 text-fg",
      )}
    >
      {n}
    </button>
  );
}

function Ellipsis() {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 text-fg-muted">
      <MoreHorizontal className="size-3.5" />
    </span>
  );
}

function PageButton({
  children,
  disabled,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 h-8 text-xs font-semibold rounded-md",
        "bg-surface hover:bg-surface-2 text-fg disabled:opacity-40 disabled:cursor-not-allowed",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
