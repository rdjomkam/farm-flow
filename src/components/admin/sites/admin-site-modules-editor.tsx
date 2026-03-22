"use client";

/**
 * admin-site-modules-editor.tsx
 *
 * Éditeur des modules d'un site depuis l'administration plateforme.
 * Toggle Switch (Radix) par module.
 * Modules de niveau "platform" sont affichés grisés (non modifiables pour les sites clients).
 *
 * Submit → PATCH /api/admin/sites/[id]/modules
 * R6 : CSS variables du thème uniquement.
 *
 * ADR-021 section 4.2 — AdminSiteModulesEditor.
 */

import { useState } from "react";
import { Save } from "lucide-react";
import { SiteModule } from "@/types";
import { SITE_MODULES_CONFIG } from "@/lib/site-modules-config";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface AdminSiteModulesEditorProps {
  siteId: string;
  enabledModules: SiteModule[];
  /** Si true, le site est la plateforme elle-même (modifications bloquées). */
  isPlatform: boolean;
  onSaved?: (modules: SiteModule[]) => void;
}

export function AdminSiteModulesEditor({
  siteId,
  enabledModules: initialModules,
  isPlatform,
  onSaved,
}: AdminSiteModulesEditorProps) {
  const [enabled, setEnabled] = useState<Set<SiteModule>>(new Set(initialModules));
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isDirty =
    enabled.size !== initialModules.length ||
    [...enabled].some((m) => !initialModules.includes(m));

  function toggle(module: SiteModule, checked: boolean) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(module);
      else next.delete(module);
      return next;
    });
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledModules: [...enabled] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la mise à jour des modules.");
      }
      const data = await res.json();
      toast({ title: "Modules mis à jour", variant: "success" });
      onSaved?.(data.enabledModules ?? [...enabled]);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const siteModules = SITE_MODULES_CONFIG.filter((m) => m.level === "site");
  const platformModules = SITE_MODULES_CONFIG.filter((m) => m.level === "platform");

  return (
    <div className="space-y-6">
      {isPlatform && (
        <div className="rounded-lg bg-accent-blue-muted px-4 py-3 text-sm text-accent-blue">
          Ce site est le site plateforme. Les modules ne peuvent pas être modifiés via cette interface.
        </div>
      )}

      {/* Modules site-level */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Modules du site</h3>
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {siteModules.map((mod) => {
            const Icon = mod.icon;
            const isOn = enabled.has(mod.value);
            const isDisabled = isPlatform;
            return (
              <div
                key={mod.value}
                className="flex items-center justify-between gap-4 bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {mod.labelKey}
                  </span>
                </div>
                <button
                  role="switch"
                  aria-checked={isOn}
                  onClick={() => !isDisabled && toggle(mod.value, !isOn)}
                  disabled={isDisabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${isOn ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${isOn ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modules platform-level (affichés mais non modifiables pour les sites clients) */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Modules réservés plateforme{" "}
          <span className="text-xs font-normal text-muted-foreground">(non activables)</span>
        </h3>
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden opacity-60">
          {platformModules.map((mod) => {
            const Icon = mod.icon;
            const isOn = isPlatform;
            return (
              <div
                key={mod.value}
                className="flex items-center justify-between gap-4 bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {mod.labelKey}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    plateforme
                  </span>
                </div>
                <button
                  role="switch"
                  aria-checked={isOn}
                  disabled
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full border-2 border-transparent transition-colors opacity-50 ${isOn ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${isOn ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      {!isPlatform && (
        <Button
          onClick={handleSave}
          disabled={!isDirty || loading}
          className="w-full sm:w-auto"
        >
          <Save className="h-4 w-4" />
          {loading ? "Enregistrement..." : "Appliquer les modules"}
        </Button>
      )}
    </div>
  );
}
