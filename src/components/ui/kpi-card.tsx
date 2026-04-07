import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBgColor: string;
  trend?: { direction: "up" | "down"; label: string };
  compact?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBgColor,
  trend,
  compact,
  className,
}: KPICardProps) {
  const content = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {trend && (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              trend.direction === "up" ? "text-accent-green" : "text-accent-red"
            )}
          >
            {trend.direction === "up" ? "+" : "-"}{trend.label}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          iconBgColor
        )}
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
  );

  if (compact) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}
