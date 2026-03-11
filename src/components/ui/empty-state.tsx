import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-16 text-center", className)}>
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground/60">
          {icon}
        </div>
      )}
      <div className="max-w-[280px]">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
