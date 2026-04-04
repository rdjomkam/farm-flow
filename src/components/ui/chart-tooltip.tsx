"use client";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number, name: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const formattedLabel = labelFormatter ? labelFormatter(String(label ?? "")) : label;

  return (
    <div className="animate-scale-in rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-elevated)]">
      {formattedLabel && (
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          {formattedLabel}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-bold">
              {valueFormatter ? valueFormatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crosshair cursor — draws vertical + horizontal dashed lines at the active
// data point so users can read both axis values at a glance.
// Pass as: <Tooltip cursor={<ChartCrosshair />} />
// ---------------------------------------------------------------------------

interface CrosshairPoint {
  x: number;
  y: number;
}

interface ChartCrosshairProps {
  points?: CrosshairPoint[];
  width?: number;
  height?: number;
  top?: number;
  left?: number;
}

export function ChartCrosshair({
  points,
  width,
  height,
  top,
  left,
}: ChartCrosshairProps) {
  if (!points || points.length === 0 || width == null || height == null || top == null || left == null) {
    return null;
  }

  const { x, y } = points[0];

  return (
    <g>
      {/* Vertical line */}
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={top + height}
        stroke="var(--muted-foreground)"
        strokeDasharray="4 4"
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      {/* Horizontal line (primary series) */}
      <line
        x1={left}
        y1={y}
        x2={left + width}
        y2={y}
        stroke="var(--muted-foreground)"
        strokeDasharray="4 4"
        strokeOpacity={0.45}
        strokeWidth={1}
      />
    </g>
  );
}
