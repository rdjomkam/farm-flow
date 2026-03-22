"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Building2,
  Users,
  Container,
  Waves,
  Plus,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { MemberActionsDialog } from "@/components/sites/member-actions-dialog";
import { cn } from "@/lib/utils";
import { Permission, SiteModule } from "@/types";
import { canAssignRole } from "@/lib/permissions-constants";
import { useUserService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";


interface SiteRoleOption {
  id: string;
  name: string;
  permissions: Permission[];
}

interface MemberData {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  siteRoleId: string;
  siteRoleName: string;
  isActive: boolean;
  createdAt: Date;
}

interface Props {
  site: {
    id: string;
    name: string;
    address: string | null;
    bacCount: number;
    vagueCount: number;
    enabledModules: string[];
  };
  members: MemberData[];
  siteRoles: SiteRoleOption[];
  currentUserId: string;
  callerPermissions: Permission[];
  canManageMembers: boolean;
  canManageSite: boolean;
}

export function SiteDetailClient({
  site,
  members,
  siteRoles,
  currentUserId,
  callerPermissions,
  canManageMembers,
  canManageSite,
}: Props) {
  const queryClient = useQueryClient();
  const userService = useUserService();

  // Modules state (optimistic)
  const [enabledModules, setEnabledModules] = useState<string[]>(site.enabledModules);
  const [modulesLoading, setModulesLoading] = useState(false);

  async function handleToggleModule(moduleValue: SiteModule) {
    if (!canManageSite || modulesLoading) return;

    const isEnabled = enabledModules.includes(moduleValue);
    const nextModules = isEnabled
      ? enabledModules.filter((m) => m !== moduleValue)
      : [...enabledModules, moduleValue];

    // Optimistic update
    setEnabledModules(nextModules);
    setModulesLoading(true);

    try {
      const { ok } = await userService.updateSite(site.id, {
        enabledModules: nextModules,
      });

      if (!ok) {
        // Revert on failure
        setEnabledModules(enabledModules);
      }
    } finally {
      setModulesLoading(false);
    }
  }

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [memberSiteRoleId, setMemberSiteRoleId] = useState<string>(
    siteRoles.find((r) => r.name === "Pisciculteur")?.id ?? siteRoles[siteRoles.length - 1]?.id ?? ""
  );

  // Roles the current user can assign (anti-escalation)
  const assignableRoles = siteRoles.filter((r) =>
    canAssignRole(callerPermissions, r.permissions)
  );

  async function handleAddMember() {
    if (!identifier.trim()) return;

    const { ok } = await userService.addMember(site.id, {
      identifier: identifier.trim(),
      siteRoleId: memberSiteRoleId,
    } as unknown as import("@/types").AddMemberDTO);

    if (ok) {
      setAddOpen(false);
      setIdentifier("");
      setMemberSiteRoleId(
        siteRoles.find((r) => r.name === "Pisciculteur")?.id ?? siteRoles[siteRoles.length - 1]?.id ?? ""
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/settings/sites"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Mes sites
      </Link>

      {/* Site info */}
      <section className="border-b border-border pb-3">
        <div className="flex items-center gap-2.5 mb-2">
          <Building2 className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-base truncate">{site.name}</h2>
            {site.address && (
              <p className="text-xs text-muted-foreground truncate">{site.address}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {members.length}
          </span>
          <span className="flex items-center gap-1">
            <Container className="h-3.5 w-3.5" />
            {site.bacCount} bac{site.bacCount > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Waves className="h-3.5 w-3.5" />
            {site.vagueCount} vague{site.vagueCount > 1 ? "s" : ""}
          </span>
        </div>
      </section>

      {/* Modules section — visible only to admins */}
      {canManageSite && (
        <section className="border-b border-border pb-3">
          <h3 className="text-sm font-semibold mb-2">Modules</h3>
          <div className="flex flex-wrap gap-2">
            {SITE_TOGGLEABLE_MODULES.map(({ value, labelKey: label, icon: Icon }) => {
              const active = enabledModules.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleToggleModule(value)}
                  disabled={modulesLoading}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Cliquez pour activer ou desactiver un module sur ce site.
          </p>
        </section>
      )}

      {/* Members section */}
      <section>
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-sm font-semibold">Membres</h3>
          <div className="flex items-center gap-2">
            {canManageSite && (
              <Link href={`/settings/sites/${site.id}/roles`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Roles
                </Button>
              </Link>
            )}
            {canManageMembers && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter un membre</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <Input
                      label="Email ou telephone"
                      placeholder="votre@email.com ou +237 6XX XXX XXX"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoFocus
                    />
                    <Select value={memberSiteRoleId} onValueChange={setMemberSiteRoleId}>
                      <SelectTrigger label="Role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button
                      onClick={handleAddMember}
                      disabled={!identifier.trim()}
                    >
                      Ajouter
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div className="divide-y divide-border">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const memberRole = siteRoles.find((r) => r.id === member.siteRoleId);
            const callerCanModify =
              canManageMembers &&
              !isCurrentUser &&
              canAssignRole(
                callerPermissions,
                memberRole?.permissions ?? []
              );

            return (
              <div key={member.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-xs font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {member.name}
                      {isCurrentUser && (
                        <span className="text-muted-foreground ml-1">(vous)</span>
                      )}
                    </span>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email ?? member.phone}
                    </p>
                    <Badge
                      className={cn(
                        "text-xs mt-1 w-fit",
                        "bg-muted text-muted-foreground"
                      )}
                    >
                      {member.siteRoleName}
                    </Badge>
                  </div>
                  {callerCanModify && (
                    <MemberActionsDialog
                      siteId={site.id}
                      member={{
                        userId: member.userId,
                        name: member.name,
                        email: member.email,
                        phone: member.phone,
                        siteRoleId: member.siteRoleId,
                        siteRoleName: member.siteRoleName,
                      }}
                      siteRoles={siteRoles}
                      callerPermissions={callerPermissions}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
