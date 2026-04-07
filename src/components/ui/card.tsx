import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Polymorphic element type — defaults to "div". Use "article" for list items, "section" for page sections. */
  as?: "div" | "article" | "section";
}

function Card({ className, interactive, as: Tag = "div", ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-card)]",
        interactive && [
          "transition-all duration-200 ease-out cursor-pointer",
          "hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 hover:border-primary/20",
          "active:translate-y-0 active:shadow-[var(--shadow-xs)]",
        ],
        className
      )}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold leading-tight [text-wrap:balance]", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** optical: true applies pb-5 (20px) for better visual balance on content-heavy cards */
  optical?: boolean;
}

function CardContent({ className, optical, ...props }: CardContentProps) {
  return (
    <div className={cn("p-4 pt-0", optical && "pb-5", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center p-4 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
