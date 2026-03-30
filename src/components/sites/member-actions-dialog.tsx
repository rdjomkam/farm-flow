"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Settings, UserMinus, Mail, Phone, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Permission } from "@/types";
import {
  canAssignRole,
  PERMISSION_GROUPS,
} from "@/lib/permissions-constants";
import { groupLabels, permissionLabels } from "@/lib/role-form-labels";
import { cn } from "@/lib/utils";
import { useUserService } from "@/services";
import { queryKeys } from "@/lib/query-keys";

interface SiteRoleOption {
  id: string;
  name: string;
  permissions: Permission[];
}

interface MemberActionsDialogProps {
  siteId: string;
  member: {
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    siteRoleId: string;
    siteRoleName: string;
  };
  siteRoles: SiteRoleOption[];
  callerPermissions: Permission[];
}

type DialogView = "main" | "permissions";

export function MemberActionsDialog({
  siteId,
  member,
  siteRoles,
  callerPermissions,
}: MemberActionsDialogProps) {
  const t = useTranslations("sites");
  const queryClient = useQueryClient();
  const userService = useUserService();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DialogView>("main");
  const [confirmRemove, setConfirmRemove] = useState(false);

  function resetDialog() {
    setView("main");
    setConfirmRemove(false);
  }

  // Filter roles the caller can assign (anti-escalation)
  const assignableRoles = siteRoles.filter((r) =>
    canAssignRole(callerPermissions, r.permissions)
  );

  // Current role permissions to display
  const currentRole = siteRoles.find((r) => r.id === member.siteRoleId);
  const currentRolePermissions = new Set(currentRole?.permissions ?? []);

  async function handleChangeSiteRole(newSiteRoleId: string) {
    if (newSiteRoleId === member.siteRoleId) return;
    const { ok } = await userService.updateMember(siteId, member.userId, { siteRoleId: newSiteRoleId });
    if (ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
    }
  }

  async function handleRemove() {
    const { ok } = await userService.removeMember(siteId, member.userId);
    if (ok) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
    }
    setConfirmRemove(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-11 w-11 p-0 shrink-0">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col">
        {view === "main" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("memberActions.gererTitle", { name: member.name })}</DialogTitle>
              <DialogDescription>
                {t("memberActions.gererDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Contact info */}
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {member.email && (
                  <span className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {member.email}
                  </span>
                )}
                {member.phone && (
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {member.phone}
                  </span>
                )}
              </div>

              {/* SiteRole select */}
              <Select
                value={member.siteRoleId}
                onValueChange={handleChangeSiteRole}
                disabled={assignableRoles.length === 0}
              >
                <SelectTrigger label={t("memberActions.roleLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                  {/* Show current role even if caller can't assign it */}
                  {assignableRoles.every((r) => r.id !== member.siteRoleId) && (
                    <SelectItem value={member.siteRoleId} disabled>
                      {member.siteRoleName}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {/* Link to permissions view */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setView("permissions")}
              >
                <Settings className="h-4 w-4" />
                {t("memberActions.voirPermissions")}
              </Button>

              {/* Separator */}
              <div className="border-t border-border" />

              {/* Remove member */}
              {!confirmRemove ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-danger hover:text-danger hover:bg-danger/10"
                  onClick={() => setConfirmRemove(true)}
                >
                  <UserMinus className="h-4 w-4" />
                  {t("memberActions.retirer")}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <p className="text-sm font-medium text-danger">
                    {t("memberActions.retirerTitle", { name: member.name })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("memberActions.retirerDescription")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmRemove(false)}
                    >
                      {t("memberActions.annuler")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRemove}
                    >
                      {t("memberActions.confirmer")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Permissions view — mobile-first: flex column, flex-1 scrollable area, mt-auto buttons */
          <>
            <DialogHeader>
              <DialogTitle>
                {t("memberActions.permissionsTitle", { roleName: member.siteRoleName })}
              </DialogTitle>
              <DialogDescription>
                {t("memberActions.permissionsDescription", { name: member.name })}
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable permissions list — flex-1 ensures it fills available height, min-h-0 prevents overflow */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="flex flex-col gap-3 py-1">
                {Object.entries(PERMISSION_GROUPS).map(([groupKey, groupPerms]) => (
                  <div key={groupKey}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                      {groupLabels[groupKey] ?? groupKey}
                    </p>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {groupPerms.map((perm) => {
                        const hasPermission = currentRolePermissions.has(perm);
                        return (
                          <div
                            key={perm}
                            className={cn(
                              "flex items-center gap-3 px-3 min-h-[44px] py-2",
                              !hasPermission && "opacity-40"
                            )}
                          >
                            <span
                              className={cn(
                                "h-4 w-4 rounded-full flex-shrink-0",
                                hasPermission ? "bg-primary" : "bg-muted border border-border"
                              )}
                            />
                            <span className="text-sm">
                              {permissionLabels[perm] ?? perm}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action button — mt-auto pushes it to the bottom on mobile */}
            <div className="mt-auto pt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setView("main")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("memberActions.retourBtn")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
