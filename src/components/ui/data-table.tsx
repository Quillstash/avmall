"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type PaginationState,
  type Table as ReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/** Plain-text label for a column, used on the mobile card view. Falls back to
 *  a prettified column id when the header is a render function. */
function headerText(header: unknown, id: string): string {
  if (typeof header === "string") return header;
  if (id && !id.startsWith("__")) {
    return id
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
  }
  return "";
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  /** Set to enable row selection (adds a leading checkbox column). */
  enableSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (s: RowSelectionState) => void;
  /** Per-page size (defaults to 10). */
  pageSize?: number;
  /** Initial sort applied on mount (e.g. newest-first). */
  defaultSorting?: SortingState;
  /** Hide pagination when caller wants to render their own. */
  hidePagination?: boolean;
  /** Click on a row (excluding the checkbox cell). */
  onRowClick?: (row: TData) => void;
  /** Render extra toolbar slot above the table (e.g. bulk actions). */
  toolbar?: (table: ReactTable<TData>) => React.ReactNode;
  className?: string;
}

export function DataTable<TData>({
  columns: userColumns,
  data,
  isLoading,
  emptyState,
  enableSelection,
  rowSelection,
  onRowSelectionChange,
  pageSize = 10,
  defaultSorting,
  hidePagination,
  onRowClick,
  toolbar,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting ?? []);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const columns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableSelection) return userColumns;
    return [
      {
        id: "__select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        size: 32,
      },
      ...userColumns,
    ];
  }, [enableSelection, userColumns]);

  const tableOptions = {
    data,
    columns,
    state: {
      sorting,
      pagination,
      ...(rowSelection != null && { rowSelection }),
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    ...(onRowSelectionChange && {
      onRowSelectionChange: (updater: ((s: RowSelectionState) => RowSelectionState) | RowSelectionState) => {
        const next =
          typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
        onRowSelectionChange(next);
      },
    }),
  };

  const table = useReactTable(tableOptions);

  const colCount = columns.length;

  return (
    <div className={cn("rounded-lg border border-border bg-surface shadow-sm overflow-hidden", className)}>
      {toolbar && (
        <div className="border-b border-border">{toolbar(table)}</div>
      )}
      {/* Desktop: real table (still horizontally scrollable on small laptops). */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sort = header.column.getIsSorted();
                  const isSelect = header.column.id === "__select";
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted",
                        isSelect && "w-8",
                      )}
                      style={{ width: header.column.columnDef.size }}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-fg"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sort === "asc" ? (
                            <ChevronUp className="size-3" />
                          ) : sort === "desc" ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c, j) => (
                    <td key={j} className="px-3.5 py-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3.5 py-12">
                  {emptyState ?? (
                    <div className="text-center text-sm text-fg-muted">No results.</div>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-t border-border hover:bg-surface-2 transition-colors",
                    onRowClick && "cursor-pointer",
                    row.getIsSelected() && "bg-info-bg/40",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      onClick={
                        cell.column.id === "__select" || cell.column.id === "actions"
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                      className="px-3.5 py-3 align-middle"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile/tablet: stacked cards generated from the same columns — no
          horizontal scroll. First column is the card title; the rest become
          labelled rows. Selection + actions sit in the card header. */}
      <div className="lg:hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: Math.min(pageSize, 6) }, (_, i) => (
              <div key={i} className="p-4 flex flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="px-4 py-12">
            {emptyState ?? (
              <div className="text-center text-sm text-fg-muted">No results.</div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => {
              const cells = row.getVisibleCells();
              const selectCell = cells.find((c) => c.column.id === "__select");
              const actionsCell = cells.find((c) => c.column.id === "actions");
              const content = cells.filter(
                (c) => c.column.id !== "__select" && c.column.id !== "actions",
              );
              const titleCell = content[0];
              const rest = content.slice(1);
              return (
                <div
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "p-4 flex flex-col gap-2.5",
                    onRowClick && "cursor-pointer active:bg-surface-2",
                    row.getIsSelected() && "bg-info-bg/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {selectCell && (
                        <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          {flexRender(
                            selectCell.column.columnDef.cell,
                            selectCell.getContext(),
                          )}
                        </span>
                      )}
                      {titleCell && (
                        <div className="min-w-0 font-semibold">
                          {flexRender(
                            titleCell.column.columnDef.cell,
                            titleCell.getContext(),
                          )}
                        </div>
                      )}
                    </div>
                    {actionsCell && (
                      <span
                        className="flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {flexRender(
                          actionsCell.column.columnDef.cell,
                          actionsCell.getContext(),
                        )}
                      </span>
                    )}
                  </div>
                  {rest.length > 0 && (
                    <dl className="flex flex-col gap-1.5 text-sm">
                      {rest.map((cell) => {
                        const label = headerText(
                          cell.column.columnDef.header,
                          cell.column.id,
                        );
                        return (
                          <div
                            key={cell.id}
                            className="flex items-center justify-between gap-3"
                          >
                            {label && (
                              <dt className="text-xs text-fg-muted flex-shrink-0">
                                {label}
                              </dt>
                            )}
                            <dd className="min-w-0 text-right ml-auto">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!hidePagination && (
        <div className="px-4 py-3 border-t border-border bg-surface-2 flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand-primary/30"
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100, 250].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {table.getPageCount() > 1 && (
            <Pagination
              page={table.getState().pagination.pageIndex + 1}
              total={data.length}
              perPage={table.getState().pagination.pageSize}
              onChange={(p) => table.setPageIndex(p - 1)}
            />
          )}
        </div>
      )}
    </div>
  );
}
