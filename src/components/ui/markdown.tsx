import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders admin-authored Markdown (journal bodies). react-markdown does NOT
 * render raw HTML by default, so this is XSS-safe without a separate sanitiser
 * (CLAUDE.md §19). Styling follows the site's `.prose-content` typography.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose-content max-w-none text-sm lg:text-base text-fg-muted leading-relaxed",
        "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&_h2]:mt-10 [&_h2]:mb-4",
        "[&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-fg [&_h3]:mt-8 [&_h3]:mb-3",
        "[&_p]:mb-4 [&_a]:text-brand-primary [&_a]:underline",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1.5",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_strong]:text-fg [&_strong]:font-semibold [&_img]:rounded-lg [&_img]:my-6",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
