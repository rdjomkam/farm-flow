"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Header } from "@/components/layout/header";
import { PERMISSION_GROUPS } from "@/lib/permissions-constants";
import { groupLabels, permissionLabels } from "@/lib/role-form-labels";
import { cn } from "@/lib/utils";
import { useUserService } from "@/services";

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  _count: { members: number };
}

export default function EditRolePage() {
  const t = useTranslations("sites");
  const params = useParams<{ id: string; roleId: string }>();
  const siteId = params.id;
  const roleId = params.roleId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userService = useUserService();

  const [role, setRole] = useState<RoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    userService.listRoles(siteId).then(({ data }) => {
      if (data?.roles) {
        const found = data.roles.find((r) => r.id === roleId) as RoleData | undefined;
        if (found) {
          setRole(found);
          setName(found.name);
          setDescription(found.description ?? "");
          setSelectedPerms(new Set(found.permissions));
        } else {
          toast({ title: t("roles.edit.roleIntrouvable"), variant: "error" });
          router.push(`/settings/sites/${siteId}/roles`);
        }
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, roleId]);

  function togglePermission(perm: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: t("roles.edit.erreurs.nomRequis"), variant: "error" });
      return;
    }
    if (selectedPerms.size === 0) {
      toast({ title: t("roles.edit.erreurs.auMoinsUnePermission"), variant: "error" });
      return;
    }

    const body: Record<string, unknown> = {
      permissions: Array.from(selectedPerms),
      description: description.trim() || null,
    };
    // System roles: name is readonly
    if (!role?.isSystem) {
      body.name = name.trim();
    }

    const { ok } = await userService.updateRole(siteId, roleId, body as Parameters<typeof userService.updateRole>[2]);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.roles(siteId) });
      router.push(`/settings/sites/${siteId}/roles`);
    }
  }

  async function handleDelete() {
    const { ok } = await userService.deleteRole(siteId, roleId);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.roles(siteId) });
      router.push(`/settings/sites/${siteId}/roles`);
    }
    setConfirmDelete(false);
  }

  if (loading) {
    return (
      <>
        <Header title={t("roles.edit.title")} />
        <div className="p-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  if (!role) return null;

  return (
    <>
      <Header title={role.name} />
      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
        <Link
          href={`/settings/sites/${siteId}/roles`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("roles.edit.rolesLink")}
        </Link>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <Input
              label={t("roles.edit.nomLabel")}
              placeholder={t("roles.edit.nomPlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              readOnly={role.isSystem}
              className={role.isSystem ? "opacity-60 cursor-not-allowed" : ""}
            />
            {role.isSystem && (
              <p className="text-xs text-muted-foreground -mt-2">
                {t("roles.edit.nomSysteme")}
              </p>
            )}
            <Input
              label={t("roles.edit.descriptionLabel")}
              placeholder={t("roles.edit.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t("roles.edit.permissionsLabel")}</p>
            {Object.entries(PERMISSION_GROUPS).map(([groupKey, groupPerms]) => (
              <div key={groupKey}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {groupLabels[groupKey] ?? groupKey}
                </p>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {groupPerms.map((perm) => {
                    const checked = selectedPerms.has(perm);
                    return (
                      <label
                        key={perm}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 min-h-[44px] cursor-pointer",
                          "hover:bg-muted/50 transition-colors"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm)}
                          className="h-5 w-5 rounded border-border text-primary accent-primary cursor-pointer"
                        />
                        <span className="text-sm">
                          {permissionLabels[perm] ?? perm}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/settings/sites/${siteId}/roles`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                {t("roles.edit.annuler")}
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              disabled={!name.trim() || selectedPerms.size === 0}
            >
              {t("roles.edit.enregistrer")}
            </Button>
          </div>

          {/* Delete section — only for non-system roles */}
          {!role.isSystem && (
            <div className="border-t border-border pt-4">
              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start gap-2 text-danger hover:text-danger hover:bg-danger/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("roles.edit.supprimerBtn")}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <p className="text-sm font-medium text-danger">
                    {t("roles.edit.supprimerTitle", { name: role.name })}
                  </p>
                  {role._count.members > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("roles.edit.supprimerMembres", {
                        count: role._count.members,
                        plural: role._count.members > 1 ? "s" : "",
                      })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("roles.edit.supprimerIrreversible")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      {t("roles.edit.annulerDialog")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleDelete}
                    >
                      {t("roles.edit.confirmerDialog")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </>
  );
}
