"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useNotificationService } from "@/services";
import { queryKeys } from "@/lib/query-keys";

export function NotificationBell() {
  const router = useRouter();
  const t = useTranslations("layout.notifications");
  const notificationService = useNotificationService();

  const { data: count = 0 } = useQuery({
    queryKey: queryKeys.notifications.count(),
    queryFn: async () => {
      const { data } = await notificationService.getCount();
      return data?.count ?? 0;
    },
    staleTime: 30_000, // 30s
    gcTime: 2 * 60_000,
    refetchInterval: 60_000, // poll every 60s
  });

  return (
    <button
      onClick={() => router.push("/notifications")}
      className={cn(
        "relative flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px]",
        "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={count > 0 ? t("ariaLabelUnread", { count }) : t("ariaLabel")}
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
