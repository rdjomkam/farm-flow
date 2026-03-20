"use client";

import { useRouter } from "next/navigation";
import { Role } from "@/types";
import { useAuthService } from "@/services";

interface ImpersonationBannerProps {
  targetUserName: string;
  targetUserRole: Role;
  originalUserName: string;
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: "Administrateur global",
  [Role.GERANT]: "Gerant",
  [Role.PISCICULTEUR]: "Pisciculteur",
  [Role.INGENIEUR]: "Ingenieur",
};

export function ImpersonationBanner({
  targetUserName,
  targetUserRole,
  originalUserName,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const authService = useAuthService();

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
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium truncate">
          Vous consultez l'application en tant que{" "}
          <span className="font-bold">{targetUserName}</span>{" "}
          <span className="opacity-80">({roleLabel})</span>
        </p>
        <button
          onClick={handleStopImpersonation}
          className="shrink-0 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/30 min-h-[40px]"
        >
          Reprendre ma session
        </button>
      </div>
      {originalUserName && (
        <p className="px-4 pb-2 text-xs opacity-70">
          Session admin : {originalUserName}
        </p>
      )}
    </div>
  );
}
