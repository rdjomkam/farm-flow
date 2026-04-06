import { cn } from "@/lib/utils";

const variants = {
  default: "bg-muted text-muted-foreground",
  en_cours: "bg-primary/15 text-primary",
  terminee: "bg-success/15 text-success",
  annulee: "bg-danger/15 text-danger",
  info: "bg-accent-blue-muted text-accent-blue",
  warning: "bg-accent-amber-muted text-accent-amber",
  // ADR-043 — badge générique vert (assignation active, statut positif)
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeProps };
