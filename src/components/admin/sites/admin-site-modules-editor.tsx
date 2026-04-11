"use client";

/**
 * admin-site-modules-editor.tsx
 *
 * Editeur des modules d'un site depuis l'administration plateforme.
 * Toggle Switch (Radix) par module.
 *
 * Submit → PATCH /api/admin/sites/[id]/modules
 * R6 : CSS variables du theme uniquement.
 *
 * ADR-022 Sprint B : isPlatform supprime. Tous les modules sont site-level.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { SiteModule } from "@/types";
import { SITE_MODULES_CONFIG } from "@/lib/site-modules-config";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface AdminSiteModulesEditorProps {
  siteId: string;
  enabledModules: SiteModule[];
  onSaved?: (modules: SiteModule[]) => void;
}

export function AdminSiteModulesEditor({
  siteId,
  enabledModules: initialModules,
  onSaved,
}: AdminSiteModulesEditorProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
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
        throw new Error(data.error ?? t("modulesEditor.updateError"));
      }
      const data = await res.json();
      toast({ title: t("modulesEditor.updateSuccess"), variant: "success" });
      onSaved?.(data.enabledModules ?? [...enabled]);
    } catch (err) {
      toast({
        title: t("siteStatus.toastError"),
        description: err instanceof Error ? err.message : tCommon("errors.generic"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Modules site-level */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("modules.siteModules")}</h3>
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {SITE_MODULES_CONFIG.map((mod) => {
            const Icon = mod.icon;
            const isOn = enabled.has(mod.value);
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
                  onClick={() => toggle(mod.value, !isOn)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isOn ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${isOn ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!isDirty || loading}
        className="w-full sm:w-auto"
      >
        <Save className="h-4 w-4" />
        {loading ? t("buttons.saving") : t("modulesEditor.applyModules")}
      </Button>
    </div>
  );
}
