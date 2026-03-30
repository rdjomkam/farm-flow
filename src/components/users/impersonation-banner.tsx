"use client";

import { useRouter } from "next/navigation";
import { Role } from "@/types";
import { useAuthService } from "@/services";
import { useTranslations } from "next-intl";

interface ImpersonationBannerProps {
  targetUserName: string;
  targetUserRole: Role;
  originalUserName: string;
}

export function ImpersonationBanner({
  targetUserName,
  targetUserRole,
  originalUserName,
}: ImpersonationBannerProps) {
  const t = useTranslations("users");
  const router = useRouter();
  const authService = useAuthService();

  const ROLE_LABELS: Record<Role, string> = {
    [Role.ADMIN]: t("roles.ADMIN"),
    [Role.GERANT]: t("roles.GERANT"),
    [Role.PISCICULTEUR]: t("roles.PISCICULTEUR"),
    [Role.INGENIEUR]: t("roles.INGENIEUR"),
  };

  const roleLabel = ROLE_LABELS[targetUserRole] ?? targetUserRole;

  async function handleStopImpersonation() {
    const { ok } = await authService.stopImpersonate();
    if (ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white shadow-md">
      <div className="h-[env(safe-area-inset-top)]" aria-hidden="true" />
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium truncate">
          {t("impersonation.banner.viewingAs")}{" "}
          <span className="font-bold">{targetUserName}</span>{" "}
          <span className="opacity-80">({roleLabel})</span>
        </p>
        <button
          onClick={handleStopImpersonation}
          className="shrink-0 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30 min-h-[40px]"
        >
          {t("impersonation.banner.reprendreSession")}
        </button>
      </div>
      {originalUserName && (
        <p className="px-4 pb-2 text-xs opacity-70">
          {t("impersonation.banner.sessionAdmin")} : {originalUserName}
        </p>
      )}
    </div>
  );
}
