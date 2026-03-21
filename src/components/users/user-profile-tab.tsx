"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserRoleBadge } from "./user-role-badge";
import { Role, Permission } from "@/types";
import { useUserService } from "@/services";
import { useTranslations } from "next-intl";

interface UserProfileTabProps {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    globalRole: Role;
    isActive: boolean;
    isSystem: boolean;
  };
  callerPermissions: Permission[];
}

export function UserProfileTab({ user, callerPermissions }: UserProfileTabProps) {
  const t = useTranslations("users");
  const router = useRouter();
  const userService = useUserService();

  const ROLE_OPTIONS = [
    { value: Role.PISCICULTEUR, label: t("roles.PISCICULTEUR") },
    { value: Role.GERANT, label: t("roles.GERANT") },
    { value: Role.INGENIEUR, label: t("roles.INGENIEUR") },
    { value: Role.ADMIN, label: t("roles.ADMIN") },
  ];

  const canModify =
    callerPermissions.includes(Permission.UTILISATEURS_MODIFIER) ||
    callerPermissions.includes(Permission.UTILISATEURS_GERER);
  const canDeactivate =
    callerPermissions.includes(Permission.UTILISATEURS_SUPPRIMER) ||
    callerPermissions.includes(Permission.UTILISATEURS_GERER);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [globalRole, setGlobalRole] = useState<Role>(user.globalRole);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  async function handleSave() {
    const { ok } = await userService.updateUser(user.id, {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      globalRole,
    });

    if (ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function handleToggleActive() {
    const { ok } = await userService.updateUser(user.id, { isActive: !user.isActive });

    if (ok) {
      setDeactivateOpen(false);
      router.refresh();
    }
  }

  if (user.isSystem) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t("profile.compteSysteme")}
        </div>
        <InfoRow label={t("profile.nom")} value={user.name} />
        {user.email && <InfoRow label={t("profile.email")} value={user.email} />}
        {user.phone && <InfoRow label={t("profile.telephone")} value={user.phone} />}
        <InfoRow label={t("profile.roleGlobal")} value={<UserRoleBadge role={user.globalRole} />} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status banner */}
      {!user.isActive && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {t("profile.compteDesactive")}
        </div>
      )}

      {/* Profile fields */}
      {editing ? (
        <FormSection title={t("profile.modifierProfil")} description={t("profile.modifierDescription")}>
          <Input
            id="name"
            label={t("profile.nom")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="email"
            label={t("profile.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="phone"
            label={t("profile.telephone")}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select value={globalRole} onValueChange={(v) => setGlobalRole(v as Role)}>
            <SelectTrigger label={t("profile.roleGlobal")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSection>
      ) : (
        <div className="flex flex-col gap-3">
          <InfoRow label={t("profile.nom")} value={user.name} />
          <InfoRow label={t("profile.email")} value={user.email || t("profile.nonRenseigne")} />
          <InfoRow label={t("profile.telephone")} value={user.phone || t("profile.nonRenseigne")} />
          <InfoRow label={t("profile.roleGlobal")} value={<UserRoleBadge role={user.globalRole} />} />
          <InfoRow
            label={t("profile.statut")}
            value={
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${user.isActive ? "text-green-700" : "text-gray-500"}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-gray-400"}`}
                />
                {user.isActive ? t("list.actif") : t("list.desactive")}
              </span>
            }
          />
        </div>
      )}

      {/* Action buttons */}
      {canModify && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {editing ? (
            <>
              <Button onClick={handleSave} className="flex-1">
                {t("profile.enregistrer")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setName(user.name);
                  setEmail(user.email ?? "");
                  setPhone(user.phone ?? "");
                  setGlobalRole(user.globalRole);
                }}
              >
                {t("profile.annuler")}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t("profile.modifier")}
            </Button>
          )}
        </div>
      )}

      {/* Deactivation */}
      {canDeactivate && (
        <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
          <DialogTrigger asChild>
            <Button variant={user.isActive ? "danger" : "secondary"} className="w-full sm:w-auto">
              {user.isActive ? t("profile.desactiverCompte") : t("profile.reactiverCompte")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {user.isActive ? t("profile.desactiverCompte") : t("profile.reactiverCompte")}
              </DialogTitle>
              <DialogDescription>
                {user.isActive
                  ? t("profile.desactiverDescription", { name: user.name })
                  : t("profile.reactiverDescription", { name: user.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDeactivateOpen(false)}>
                {t("profile.annuler")}
              </Button>
              <Button
                variant={user.isActive ? "danger" : "primary"}
                onClick={handleToggleActive}
              >
                {user.isActive ? t("profile.desactiver") : t("profile.reactiver")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
