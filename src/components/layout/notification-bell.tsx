"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // Silently ignore errors (user may not be authenticated)
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return (
    <button
      onClick={() => router.push("/notifications")}
      className={cn(
        "relative flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px]",
        "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={count > 0 ? `${count} notification${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}` : "Notifications"}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
