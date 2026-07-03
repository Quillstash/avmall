"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Sparkline ────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  stroke = "hsl(var(--brand-primary))",
  fill,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const sx = (i: number) => (i * width) / (data.length - 1);
  const sy = (v: number) => height - ((v - min) / range) * height;
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${sx(i)} ${sy(v)}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block", className)}
    >
      {fill && (
        <path
          d={`${path} L ${width} ${height} L 0 ${height} Z`}
          fill={fill}
          stroke="none"
        />
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── LineChart ────────────────────────────────────────────────────────────

interface LineChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  yTicks?: number[];
  formatValue?: (v: number) => string;
  className?: string;
  /** Brand color override. */
  stroke?: string;
  /** Full per-point labels (e.g. the date) shown in the hover tooltip —
   *  independent of the sparse axis `labels`. Falls back to `labels`. */
  pointLabels?: string[];
  /** Pre-formatted per-point value strings for the tooltip (e.g. money). Use
   *  this from Server Components — `formatValue` (a function) can't cross the
   *  server→client boundary, but a string array can. */
  valueLabels?: string[];
  /** Legend label for the series. When set, a legend chip is rendered. */
  seriesLabel?: string;
}

export function LineChart({
  data,
  labels,
  height = 200,
  formatValue,
  className,
  stroke = "hsl(var(--brand-primary))",
  pointLabels,
  valueLabels,
  seriesLabel,
}: LineChartProps) {
  const w = 720;
  const h = height;
  const pad = 16;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const len = data.length;
  const max = Math.max(...data, 1);
  const sx = (i: number) => pad + i * (innerW / Math.max(1, len - 1));
  const sy = (v: number) => h - pad - (v / max) * innerH;
  const line = data.map((v, i) => `${i ? "L" : "M"} ${sx(i)} ${sy(v)}`).join(" ");
  const area = `${line} L ${sx(len - 1)} ${h - pad} L ${sx(0)} ${h - pad} Z`;
  const gradId = React.useId();

  // Fraction (0..1) across the plotted area, aligned to the padded points.
  const xPct = (i: number) => (sx(i) / w) * 100;
  const yPct = (v: number) => (sy(v) / h) * 100;

  const [hi, setHi] = React.useState<number | null>(null);
  const valueAt = (i: number) =>
    valueLabels?.[i] ?? (formatValue ? formatValue(data[i] ?? 0) : String(data[i] ?? 0));

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * w;
    const step = innerW / Math.max(1, len - 1);
    const idx = Math.max(0, Math.min(len - 1, Math.round((svgX - pad) / step)));
    setHi(idx);
  }

  const hv = hi != null ? (data[hi] ?? 0) : 0;
  const hovLabel = hi != null ? (pointLabels?.[hi] ?? labels?.[hi] ?? `#${hi + 1}`) : "";
  // Keep the tooltip inside the card near the edges.
  const hoverX = hi != null ? xPct(hi) : 0;
  const tipTransform =
    hoverX < 14
      ? "translate(0, calc(-100% - 12px))"
      : hoverX > 86
        ? "translate(-100%, calc(-100% - 12px))"
        : "translate(-50%, calc(-100% - 12px))";

  return (
    <div className={className}>
      <div
        className="relative touch-none"
        style={{ height: h }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHi(null)}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height={h}
          preserveAspectRatio="none"
          className="block"
        >
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={pad}
              x2={w - pad}
              y1={pad + f * innerH}
              y2={pad + f * innerH}
              stroke="hsl(var(--border))"
              strokeDasharray="2 4"
            />
          ))}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        </svg>

        {/* Round marker on the latest point (HTML overlay → no aspect distortion). */}
        {len > 0 && hi == null && (
          <span
            className="absolute size-2.5 rounded-full border-2 pointer-events-none"
            style={{
              left: `${xPct(len - 1)}%`,
              top: `${yPct(data[len - 1] ?? 0)}%`,
              transform: "translate(-50%, -50%)",
              background: stroke,
              borderColor: "hsl(var(--surface))",
            }}
          />
        )}

        {/* Hover: guide line, marker + tooltip. */}
        {hi != null && (
          <>
            <span
              className="absolute top-0 bottom-0 w-px bg-border-strong pointer-events-none"
              style={{ left: `${hoverX}%` }}
            />
            <span
              className="absolute size-3 rounded-full border-2 pointer-events-none"
              style={{
                left: `${hoverX}%`,
                top: `${yPct(hv)}%`,
                transform: "translate(-50%, -50%)",
                background: stroke,
                borderColor: "hsl(var(--surface))",
              }}
            />
            <div
              className="absolute z-10 pointer-events-none rounded-md border border-border bg-surface shadow-md px-2.5 py-1.5 whitespace-nowrap"
              style={{ left: `${hoverX}%`, top: `${yPct(hv)}%`, transform: tipTransform }}
            >
              <div className="text-[10px] font-medium text-fg-muted">{hovLabel}</div>
              <div className="text-sm font-bold tabular flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: stroke }} />
                {hi != null ? valueAt(hi) : ""}
              </div>
            </div>
          </>
        )}
      </div>

      {labels && (
        <div className="flex justify-between text-[10px] text-fg-muted mt-1 px-4">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}

      {seriesLabel && (
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-fg-muted">
          <span className="inline-block w-3.5 h-[3px] rounded-full" style={{ background: stroke }} />
          {seriesLabel}
        </div>
      )}
    </div>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
}

export function BarChart({ data, height = 200, formatValue, className }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;
  const gap = 6;

  return (
    <div className={className}>
      <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 24);
          return (
            <rect
              key={i}
              x={i * barW + gap / 2}
              y={height - h - 12}
              width={barW - gap}
              height={h}
              rx={2}
              fill={d.color ?? "hsl(var(--brand-primary))"}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-fg-muted mt-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center"
            title={formatValue ? formatValue(d.value) : String(d.value)}
          >
            <div className="font-semibold text-fg tabular">
              {formatValue ? formatValue(d.value) : d.value}
            </div>
            <div className="truncate">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  stroke?: number;
  centerLabel?: React.ReactNode;
  className?: string;
}

export function DonutChart({
  data,
  size = 160,
  stroke = 20,
  centerLabel,
  className,
}: DonutChartProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const c = size / 2;
  const r = c - stroke / 2;
  const cir = 2 * Math.PI * r;
  let cumul = 0;
  const hovered = hover != null ? data[hover] : null;

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0 max-w-full">
        <circle cx={c} cy={c} r={r} fill="none" stroke="hsl(var(--surface-2))" strokeWidth={stroke} />
        {data.map((d, i) => {
          const len = (d.value / total) * cir;
          const off = (-cumul / total) * cir;
          cumul += d.value;
          return (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${cir}`}
              strokeDashoffset={off}
              transform={`rotate(-90 ${c} ${c})`}
              opacity={hover === null || hover === i ? 1 : 0.3}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", transition: "opacity 150ms" }}
            />
          );
        })}
        {/* Center: hovered slice details, else the default label. pointer-events
            off so the overlay doesn't steal hover from the slices beneath. */}
        <foreignObject
          x={0}
          y={0}
          width={size}
          height={size}
          style={{ pointerEvents: "none" }}
        >
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            {hovered ? (
              <>
                <div className="text-2xl font-bold tabular leading-none">{hovered.value}</div>
                <div className="text-[10px] text-fg-muted truncate max-w-[88px] mt-0.5">
                  {hovered.label}
                </div>
                <div className="text-[10px] text-fg-muted">
                  {Math.round((hovered.value / total) * 100)}%
                </div>
              </>
            ) : (
              centerLabel
            )}
          </div>
        </foreignObject>
      </svg>
      <div className="w-full sm:flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex items-center gap-2 rounded px-1.5 py-1 -mx-1.5 transition-colors cursor-default"
            style={{
              opacity: hover === null || hover === i ? 1 : 0.4,
              background: hover === i ? "hsl(var(--surface-2))" : undefined,
            }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="size-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="flex-1 min-w-0 truncate">{d.label}</span>
            <span className="font-bold tabular flex-shrink-0">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
