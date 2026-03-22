"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Permission, Role } from "@/types";
import { useUserService, useAuthService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";

interface UserSecurityTabProps {
  userId: string;
  userName: string;
  userRole: Role;
  isActive: boolean;
  isSystem: boolean;
  callerPermissions: Permission[];
}

export function UserSecurityTab({
  userId,
  userName,
  userRole,
  isActive,
  isSystem,
  callerPermissions,
}: UserSecurityTabProps) {
  const t = useTranslations("users");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userService = useUserService();
  const authService = useAuthService();

  const canManage = callerPermissions.includes(Permission.UTILISATEURS_GERER);
  const canImpersonate = callerPermissions.includes(Permission.UTILISATEURS_IMPERSONNER);

  // Password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Force logout state
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Impersonation state
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  const impersonationDisabled =
    userRole === Role.ADMIN || isSystem || !isActive;

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordError(t("security.errors.motDePasseTropCourt"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("security.errors.motDePasseNonCorrespondant"));
      return;
    }

    const { ok } = await userService.resetPassword(userId, { newPassword });
    if (ok) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleForceLogout() {
    const { ok, data } = await userService.deleteUserSessions(userId);
    if (ok) {
      const resultData = data as { deletedCount?: number } | null;
      if (resultData?.deletedCount !== undefined) {
        toast({
          title: `${resultData.deletedCount} session(s) supprimee(s).`,
          variant: "success",
        });
      }
      setLogoutOpen(false);
    }
  }

  async function handleImpersonate() {
    const { ok } = await authService.impersonate(userId);
    if (ok) {
      setImpersonateOpen(false);
      router.push("/");
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    } else {
      setImpersonateOpen(false);
    }
  }

  if (isSystem) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {t("security.compteSysteme")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Password reset */}
      {canManage && (
        <FormSection title={t("security.reinitialiserMotDePasse")} description={t("security.reinitialiserDescription")}>
          <form onSubmit={handlePasswordReset} className="flex flex-col gap-3">
            <Input
              id="newPassword"
              label={t("security.nouveauMotDePasse")}
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              id="confirmPassword"
              label={t("security.confirmerMotDePasse")}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={passwordError}
            />
            <Button type="submit" className="w-full sm:w-auto">
              {t("security.changerMotDePasse")}
            </Button>
          </form>
        </FormSection>
      )}

      {/* Force logout */}
      {canManage && (
        <FormSection
          title={t("security.deconnexionForcee")}
          description={t("security.deconnexionForceeDescription")}
        >
          <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="w-full sm:w-auto">
                {t("security.forcerDeconnexion")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("security.forcerDeconnexionConfirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("security.forcerDeconnexionConfirmDescription", { name: userName })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
                  {t("security.annuler")}
                </Button>
                <Button variant="danger" onClick={handleForceLogout}>
                  {t("security.forcerDeconnexion")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </FormSection>
      )}

      {/* Impersonation */}
      {canImpersonate && (
        <FormSection
          title={t("impersonation.sectionTitle")}
          description={t("impersonation.sectionDescription")}
        >
          {impersonationDisabled ? (
            <p className="text-sm text-muted-foreground">
              {userRole === Role.ADMIN
                ? t("impersonation.disabled.admin")
                : !isActive
                ? t("impersonation.disabled.desactive")
                : t("impersonation.disabled.default")}
            </p>
          ) : (
            <Dialog open={impersonateOpen} onOpenChange={setImpersonateOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full sm:w-auto">
                  {t("impersonation.button")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("impersonation.confirmTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("impersonation.confirmDescription", { name: userName })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setImpersonateOpen(false)}>
                    {t("impersonation.annuler")}
                  </Button>
                  <Button onClick={handleImpersonate}>
                    {t("impersonation.continuer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </FormSection>
      )}
    </div>
  );
}
