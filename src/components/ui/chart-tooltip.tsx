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
