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
}

export function LineChart({
  data,
  labels,
  height = 200,
  formatValue,
  className,
  stroke = "hsl(var(--brand-primary))",
}: LineChartProps) {
  const w = 720;
  const h = height;
  const pad = 16;
  const max = Math.max(...data, 1);
  const sx = (i: number) => pad + i * ((w - pad * 2) / Math.max(1, data.length - 1));
  const sy = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? "L" : "M"} ${sx(i)} ${sy(v)}`).join(" ");
  const area = `${line} L ${sx(data.length - 1)} ${h - pad} L ${sx(0)} ${h - pad} Z`;
  const last = data[data.length - 1] ?? 0;
  const gradId = React.useId();

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
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
            y1={pad + f * (h - pad * 2)}
            y2={pad + f * (h - pad * 2)}
            stroke="hsl(var(--border))"
            strokeDasharray="2 4"
          />
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        <circle
          cx={sx(data.length - 1)}
          cy={sy(last)}
          r="5"
          fill={stroke}
          stroke="hsl(var(--surface))"
          strokeWidth="2"
        />
      </svg>
      {labels && (
        <div className="flex justify-between text-[10px] text-fg-muted mt-1 px-4">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
      {formatValue && (
        <div className="sr-only">Last value: {formatValue(last)}</div>
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
