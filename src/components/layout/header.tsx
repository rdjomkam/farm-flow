import { cn } from "@/lib/utils";
import { HamburgerMenu } from "./hamburger-menu";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function Header({ title, children, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex min-h-[56px] items-center justify-between border-b border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <HamburgerMenu />
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </header>
  );
}
