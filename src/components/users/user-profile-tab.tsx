"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { useToast } from "@/components/ui/toast";
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

const ROLE_OPTIONS = [
  { value: Role.PISCICULTEUR, label: "Pisciculteur" },
  { value: Role.GERANT, label: "Gerant" },
  { value: Role.INGENIEUR, label: "Ingenieur" },
  { value: Role.ADMIN, label: "Administrateur global" },
];

export function UserProfileTab({ user, callerPermissions }: UserProfileTabProps) {
  const router = useRouter();
  const { toast } = useToast();

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
  const [submitting, setSubmitting] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          globalRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Erreur lors de la modification.", variant: "error" });
        return;
      }

      toast({ title: "Profil mis a jour.", variant: "success" });
      setEditing(false);
      router.refresh();
    } catch {
      toast({ title: "Erreur reseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive() {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Erreur.", variant: "error" });
        return;
      }

      toast({
        title: user.isActive ? "Compte desactive." : "Compte reactive.",
        variant: "success",
      });
      setDeactivateOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Erreur reseau.", variant: "error" });
    } finally {
      setDeactivating(false);
    }
  }

  if (user.isSystem) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Cet utilisateur est un compte systeme. Il ne peut pas etre modifie.
        </div>
        <InfoRow label="Nom" value={user.name} />
        {user.email && <InfoRow label="Email" value={user.email} />}
        {user.phone && <InfoRow label="Telephone" value={user.phone} />}
        <InfoRow label="Role" value={<UserRoleBadge role={user.globalRole} />} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status banner */}
      {!user.isActive && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          Ce compte est desactive. L'utilisateur ne peut pas se connecter.
        </div>
      )}

      {/* Profile fields */}
      {editing ? (
        <FormSection title="Modifier le profil" description="Mettez a jour les informations">
          <Input
            id="name"
            label="Nom complet"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="phone"
            label="Telephone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select value={globalRole} onValueChange={(v) => setGlobalRole(v as Role)}>
            <SelectTrigger label="Role global">
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
          <InfoRow label="Nom" value={user.name} />
          <InfoRow label="Email" value={user.email || "Non renseigne"} />
          <InfoRow label="Telephone" value={user.phone || "Non renseigne"} />
          <InfoRow label="Role" value={<UserRoleBadge role={user.globalRole} />} />
          <InfoRow
            label="Statut"
            value={
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${user.isActive ? "text-green-700" : "text-gray-500"}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-gray-400"}`}
                />
                {user.isActive ? "Actif" : "Desactive"}
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
              <Button onClick={handleSave} disabled={submitting} className="flex-1">
                {submitting ? "Enregistrement..." : "Enregistrer"}
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
                disabled={submitting}
              >
                Annuler
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Modifier le profil
            </Button>
          )}
        </div>
      )}

      {/* Deactivation */}
      {canDeactivate && (
        <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
          <DialogTrigger asChild>
            <Button variant={user.isActive ? "danger" : "secondary"} className="w-full sm:w-auto">
              {user.isActive ? "Desactiver le compte" : "Reactiver le compte"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {user.isActive ? "Desactiver le compte" : "Reactiver le compte"}
              </DialogTitle>
              <DialogDescription>
                {user.isActive
                  ? `L'utilisateur ${user.name} ne pourra plus se connecter. Vous pouvez reactiver le compte a tout moment.`
                  : `L'utilisateur ${user.name} pourra a nouveau se connecter.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDeactivateOpen(false)} disabled={deactivating}>
                Annuler
              </Button>
              <Button
                variant={user.isActive ? "danger" : "primary"}
                onClick={handleToggleActive}
                disabled={deactivating}
              >
                {deactivating ? "En cours..." : user.isActive ? "Desactiver" : "Reactiver"}
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
