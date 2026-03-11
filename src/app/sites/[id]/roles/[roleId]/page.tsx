"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Header } from "@/components/layout/header";
import { PERMISSION_GROUPS } from "@/lib/permissions-constants";
import { groupLabels, permissionLabels } from "@/lib/role-form-labels";
import { cn } from "@/lib/utils";

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  _count: { members: number };
}

export default function EditRolePage() {
  const params = useParams<{ id: string; roleId: string }>();
  const siteId = params.id;
  const roleId = params.roleId;
  const router = useRouter();
  const { toast } = useToast();

  const [role, setRole] = useState<RoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchRole() {
      try {
        const res = await fetch(`/api/sites/${siteId}/roles/${roleId}`);
        const data = await res.json();
        if (res.ok) {
          setRole(data);
          setName(data.name);
          setDescription(data.description ?? "");
          setSelectedPerms(new Set(data.permissions));
        } else {
          toast({ title: data.message || "Role introuvable", variant: "error" });
          router.push(`/sites/${siteId}/roles`);
        }
      } catch {
        toast({ title: "Erreur reseau", variant: "error" });
      } finally {
        setLoading(false);
      }
    }
    fetchRole();
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
      toast({ title: "Le nom du role est obligatoire.", variant: "error" });
      return;
    }
    if (selectedPerms.size === 0) {
      toast({ title: "Selectionnez au moins une permission.", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        permissions: Array.from(selectedPerms),
        description: description.trim() || null,
      };
      // System roles: name is readonly
      if (!role?.isSystem) {
        body.name = name.trim();
      }

      const res = await fetch(`/api/sites/${siteId}/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Role mis a jour", variant: "success" });
        router.push(`/sites/${siteId}/roles`);
      } else {
        toast({ title: data.message || "Erreur lors de la mise a jour", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/roles/${roleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Role supprime", variant: "success" });
        router.push(`/sites/${siteId}/roles`);
      } else {
        toast({ title: data.message || "Erreur lors de la suppression", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Role" />
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
          href={`/sites/${siteId}/roles`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Roles
        </Link>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <Input
              label="Nom du role"
              placeholder="Nom du role"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              readOnly={role.isSystem}
              className={role.isSystem ? "opacity-60 cursor-not-allowed" : ""}
            />
            {role.isSystem && (
              <p className="text-xs text-muted-foreground -mt-2">
                Le nom d&apos;un role systeme ne peut pas etre modifie.
              </p>
            )}
            <Input
              label="Description (optionnelle)"
              placeholder="Description du role"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Permissions</p>
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
            <Link href={`/sites/${siteId}/roles`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || !name.trim() || selectedPerms.size === 0}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
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
                  Supprimer ce role
                </Button>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <p className="text-sm font-medium text-danger">
                    Supprimer le role &quot;{role.name}&quot; ?
                  </p>
                  {role._count.members > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {role._count.members} membre{role._count.members > 1 ? "s" : ""} seront reassignes au role le moins privilegie.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Cette action est irreversible.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Suppression..." : "Confirmer"}
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
