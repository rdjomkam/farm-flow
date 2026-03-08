import { cn } from "@/lib/utils";

const variants = {
  default: "bg-muted text-muted-foreground",
  en_cours: "bg-primary/15 text-primary",
  terminee: "bg-success/15 text-success",
  annulee: "bg-danger/15 text-danger",
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
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
