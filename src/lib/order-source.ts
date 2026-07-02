/**
 * Single source of truth for order channels ("where did this sale come from").
 * Mirrors the `OrderSource` enum in prisma/schema.prisma — keep the two in sync.
 *
 * Pure data (no icons / no React) so it's safe to import from both server route
 * handlers and client components.
 */

/** Every channel, in the order it should appear in pickers, filters and legends. */
export const ORDER_SOURCES = [
  { value: "walkin", label: "Walk-in" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "phone", label: "Phone" },
  { value: "web", label: "Website" },
  { value: "manual", label: "Manual" },
  { value: "ai", label: "AI agent" },
] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number]["value"];

export const ORDER_SOURCE_LABELS = Object.fromEntries(
  ORDER_SOURCES.map((s) => [s.value, s.label]),
) as Record<OrderSource, string>;

/**
 * Channels a staff member can pick when creating an order by hand (register or
 * the "Create order" screen). Excludes `ai`, which is only ever set
 * server-side by the AI agent, never chosen at a counter.
 */
export const MANUAL_ORDER_SOURCES = ORDER_SOURCES.filter((s) => s.value !== "ai");

/** The value the two manual-create surfaces default to. */
export const DEFAULT_MANUAL_SOURCE: OrderSource = "walkin";
