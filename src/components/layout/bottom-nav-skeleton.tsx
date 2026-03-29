export function BottomNavSkeleton() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 py-2"
          >
            <div className="h-5 w-5 animate-pulse rounded-md bg-muted" />
            <div className="h-2.5 w-8 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </nav>
  );
}
