"use client";

import Link from "next/link";
import { Plus, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JournalAdminRow } from "@/lib/data/content";

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(d));
}

export function JournalListClient({ posts }: { posts: JournalAdminRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link href="/admin/content/journal/new">
          <Button size="sm">
            <Plus className="size-3.5" /> New post
          </Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
          <Newspaper className="size-8 text-fg-muted mx-auto mb-3" />
          <p className="text-sm text-fg-muted mb-4">No journal posts yet.</p>
          <Link href="/admin/content/journal/new">
            <Button size="sm">Write your first post</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-surface-2">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted text-left">
                  <th className="px-3.5 py-2.5">Title</th>
                  <th className="px-3.5 py-2.5">Category</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Published</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-3.5 py-3">
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-[11px] text-fg-muted font-mono">/journal/{p.slug}</div>
                    </td>
                    <td className="px-3.5 py-3 text-fg-muted">{p.category || "—"}</td>
                    <td className="px-3.5 py-3">
                      {p.published ? (
                        <Badge tone="success">Published</Badge>
                      ) : (
                        <Badge tone="neutral">Draft</Badge>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-fg-muted text-xs">{fmt(p.publishedAt)}</td>
                    <td className="px-3.5 py-3 text-right">
                      <Link
                        href={`/admin/content/journal/${p.id}`}
                        className="text-sm font-semibold text-brand-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
