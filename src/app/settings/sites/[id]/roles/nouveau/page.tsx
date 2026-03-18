"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Header } from "@/components/layout/header";
import { PERMISSION_GROUPS } from "@/lib/permissions-constants";
import { groupLabels, permissionLabels } from "@/lib/role-form-labels";
import { cn } from "@/lib/utils";

export default function NewRolePage() {
  const params = useParams<{ id: string }>();
  const siteId = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

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
      const res = await fetch(`/api/sites/${siteId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selectedPerms),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Role cree avec succes", variant: "success" });
        router.push(`/settings/sites/${siteId}/roles`);
      } else {
        toast({ title: data.message || "Erreur lors de la creation", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Nouveau role" />
      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
        <Link
          href={`/settings/sites/${siteId}/roles`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Roles
        </Link>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <Input
              label="Nom du role"
              placeholder="Ex: Technicien eau"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Description (optionnelle)"
              placeholder="Ex: Responsable de la qualite de l'eau"
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
            <Link href={`/settings/sites/${siteId}/roles`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || !name.trim() || selectedPerms.size === 0}
            >
              {saving ? "Creation..." : "Creer le role"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
