"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      setPasswordError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
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
      router.refresh();
    } else {
      setImpersonateOpen(false);
    }
  }

  if (isSystem) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Cet utilisateur est un compte systeme. Les actions de securite ne sont pas disponibles.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Password reset */}
      {canManage && (
        <FormSection title="Reinitialiser le mot de passe" description="Definissez un nouveau mot de passe pour cet utilisateur">
          <form onSubmit={handlePasswordReset} className="flex flex-col gap-3">
            <Input
              id="newPassword"
              label="Nouveau mot de passe"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              id="confirmPassword"
              label="Confirmer le mot de passe"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={passwordError}
            />
            <Button type="submit" className="w-full sm:w-auto">
              Changer le mot de passe
            </Button>
          </form>
        </FormSection>
      )}

      {/* Force logout */}
      {canManage && (
        <FormSection
          title="Deconnexion forcee"
          description="Supprime toutes les sessions actives de cet utilisateur. Il devra se reconnecter."
        >
          <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="w-full sm:w-auto">
                Forcer la deconnexion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Forcer la deconnexion</DialogTitle>
                <DialogDescription>
                  Toutes les sessions actives de {userName} seront supprimees. Cette action ne peut pas etre annulee.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
                  Annuler
                </Button>
                <Button variant="danger" onClick={handleForceLogout}>
                  Forcer la deconnexion
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </FormSection>
      )}

      {/* Impersonation */}
      {canImpersonate && (
        <FormSection
          title="Impersonation"
          description="Se connecter en tant que cet utilisateur pour voir l'application a sa place."
        >
          {impersonationDisabled ? (
            <p className="text-sm text-muted-foreground">
              {userRole === Role.ADMIN
                ? "Impossible d'impersonner un administrateur."
                : !isActive
                ? "Impossible d'impersonner un compte desactive."
                : "L'impersonation n'est pas disponible pour cet utilisateur."}
            </p>
          ) : (
            <Dialog open={impersonateOpen} onOpenChange={setImpersonateOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full sm:w-auto">
                  Se connecter en tant que cet utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmer l'impersonation</DialogTitle>
                  <DialogDescription>
                    Vous allez vous connecter en tant que {userName}. Vous verrez l'application exactement comme cet utilisateur. Un bandeau vous permettra de reprendre votre session.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setImpersonateOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleImpersonate}>
                    Continuer
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
