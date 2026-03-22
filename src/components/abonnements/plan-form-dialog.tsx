"use client";
/**
 * src/components/abonnements/plan-form-dialog.tsx
 *
 * Dialog de création et modification d'un plan d'abonnement.
 * - Création : POST /api/plans
 * - Modification : PUT /api/plans/[id]
 *
 * Story 38.2 — Sprint 38
 * R2 : enums importés depuis @/types
 * R5 : DialogTrigger asChild — OBLIGATOIRE
 * R6 : CSS variables du thème
 */
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TypePlan, SiteModule } from "@/types";
import { PLAN_LABELS } from "@/lib/abonnements-constants";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanAdminItem {
  id: string;
  nom: string;
  typePlan: TypePlan;
  description: string | null;
  prixMensuel: number | null;
  prixTrimestriel: number | null;
  prixAnnuel: number | null;
  limitesSites: number;
  limitesBacs: number;
  limitesVagues: number;
  limitesIngFermes: number | null;
  isActif: boolean;
  isPublic: boolean;
  modulesInclus: SiteModule[];
  _count: {
    abonnements: number;
  };
}

interface PlanFormDialogProps {
  /** Si fourni : mode édition avec le plan pré-rempli. Sinon : mode création. */
  plan?: PlanAdminItem;
  /** Appelé après succès pour rafraîchir la liste */
  onSuccess?: () => void;
  /** Déclencheur (bouton) passé comme children */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Types de plans où limitesIngFermes est pertinente */
const INGENIEUR_TYPES: TypePlan[] = [
  TypePlan.INGENIEUR_STARTER,
  TypePlan.INGENIEUR_PRO,
  TypePlan.INGENIEUR_EXPERT,
];

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function PlanFormDialog({ plan, onSuccess, children }: PlanFormDialogProps) {
  const isEditing = !!plan;
  const queryClient = useQueryClient();
  const t = useTranslations("abonnements");
  const tNav = useTranslations("navigation");

  const TYPE_PLAN_OPTIONS = useMemo(
    () =>
      Object.values(TypePlan).map((tp) => ({
        value: tp,
        label: t(PLAN_LABELS[tp]),
      })),
    [t]
  );

  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [typePlan, setTypePlan] = useState<TypePlan>(TypePlan.DECOUVERTE);
  const [description, setDescription] = useState("");
  const [prixMensuel, setPrixMensuel] = useState("");
  const [prixTrimestriel, setPrixTrimestriel] = useState("");
  const [prixAnnuel, setPrixAnnuel] = useState("");
  const [limitesBacs, setLimitesBacs] = useState("3");
  const [limitesVagues, setLimitesVagues] = useState("1");
  const [limitesSites, setLimitesSites] = useState("1");
  const [limitesIngFermes, setLimitesIngFermes] = useState("");
  const [isActif, setIsActif] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [modulesInclus, setModulesInclus] = useState<SiteModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);

  // Réinitialiser le formulaire quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      if (plan) {
        setNom(plan.nom);
        setTypePlan(plan.typePlan);
        setDescription(plan.description ?? "");
        setPrixMensuel(plan.prixMensuel !== null ? String(plan.prixMensuel) : "");
        setPrixTrimestriel(plan.prixTrimestriel !== null ? String(plan.prixTrimestriel) : "");
        setPrixAnnuel(plan.prixAnnuel !== null ? String(plan.prixAnnuel) : "");
        setLimitesBacs(String(plan.limitesBacs));
        setLimitesVagues(String(plan.limitesVagues));
        setLimitesSites(String(plan.limitesSites));
        setLimitesIngFermes(plan.limitesIngFermes !== null ? String(plan.limitesIngFermes) : "");
        setIsActif(plan.isActif);
        setIsPublic(plan.isPublic);
        setModulesInclus(plan.modulesInclus ?? []);
      } else {
        setNom("");
        setTypePlan(TypePlan.DECOUVERTE);
        setDescription("");
        setPrixMensuel("");
        setPrixTrimestriel("");
        setPrixAnnuel("");
        setLimitesBacs("3");
        setLimitesVagues("1");
        setLimitesSites("1");
        setLimitesIngFermes("");
        setIsActif(true);
        setIsPublic(true);
        setModulesInclus([]);
      }
      setErrors([]);
    }
  }, [open, plan]);

  const isIngenieurType = INGENIEUR_TYPES.includes(typePlan);

  function getError(field: string) {
    return errors.find((e) => e.field === field)?.message;
  }

  function parsePrix(val: string): number | null {
    if (val === "" || val === undefined) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function toggleModule(module: SiteModule) {
    setModulesInclus((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
  }

  /** Map SiteModule enum value to navigation i18n key under "modules.*" */
  function getModuleNavKey(module: SiteModule): string {
    const map: Record<SiteModule, string> = {
      [SiteModule.REPRODUCTION]: "modules.reproduction",
      [SiteModule.GROSSISSEMENT]: "modules.grossissement",
      [SiteModule.INTRANTS]: "modules.intrants",
      [SiteModule.VENTES]: "modules.ventes",
      [SiteModule.ANALYSE_PILOTAGE]: "modules.analysePilotage",
      [SiteModule.PACKS_PROVISIONING]: "modules.packsProvisioning",
      [SiteModule.CONFIGURATION]: "modules.configuration",
      [SiteModule.INGENIEUR]: "modules.ingenieur",
      [SiteModule.NOTES]: "modules.notes",
      // platform-only — not shown, included for type-safety
      [SiteModule.ABONNEMENTS]: "modules.abonnement",
      [SiteModule.COMMISSIONS]: "modules.adminCommissions",
      [SiteModule.REMISES]: "modules.adminRemises",
    };
    return map[module];
  }

  async function handleSubmit(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    setErrors([]);

    // Validation côté client
    const clientErrors: { field: string; message: string }[] = [];

    if (!nom.trim()) {
      clientErrors.push({ field: "nom", message: "Le nom du plan est requis." });
    }

    if (!isEditing && !typePlan) {
      clientErrors.push({ field: "typePlan", message: "Le type de plan est requis." });
    }

    const prixMensuelNum = parsePrix(prixMensuel);
    const prixTrimestrielNum = parsePrix(prixTrimestriel);
    const prixAnnuelNum = parsePrix(prixAnnuel);

    if (prixMensuelNum !== null && prixMensuelNum < 0) {
      clientErrors.push({ field: "prixMensuel", message: "Le prix mensuel doit être >= 0." });
    }
    if (prixTrimestrielNum !== null && prixTrimestrielNum < 0) {
      clientErrors.push({ field: "prixTrimestriel", message: "Le prix trimestriel doit être >= 0." });
    }
    if (prixAnnuelNum !== null && prixAnnuelNum < 0) {
      clientErrors.push({ field: "prixAnnuel", message: "Le prix annuel doit être >= 0." });
    }

    const limitesBacsNum = parseInt(limitesBacs);
    if (isNaN(limitesBacsNum) || limitesBacsNum < 1) {
      clientErrors.push({ field: "limitesBacs", message: "La limite de bacs doit être >= 1." });
    }

    const limitesVaguesNum = parseInt(limitesVagues);
    if (isNaN(limitesVaguesNum) || limitesVaguesNum < 1) {
      clientErrors.push({ field: "limitesVagues", message: "La limite de vagues doit être >= 1." });
    }

    const limitesSitesNum = parseInt(limitesSites);
    if (isNaN(limitesSitesNum) || limitesSitesNum < 1) {
      clientErrors.push({ field: "limitesSites", message: "La limite de sites doit être >= 1." });
    }

    if (limitesIngFermes !== "") {
      const ingFermesNum = parseInt(limitesIngFermes);
      if (isNaN(ingFermesNum) || ingFermesNum < 1) {
        clientErrors.push({ field: "limitesIngFermes", message: "La limite de fermes ingénieur doit être >= 1." });
      }
    }

    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        nom: nom.trim(),
        description: description.trim() || undefined,
        prixMensuel: prixMensuelNum,
        prixTrimestriel: prixTrimestrielNum,
        prixAnnuel: prixAnnuelNum,
        limitesBacs: parseInt(limitesBacs),
        limitesVagues: parseInt(limitesVagues),
        limitesSites: parseInt(limitesSites),
        limitesIngFermes: limitesIngFermes !== "" ? parseInt(limitesIngFermes) : undefined,
        isActif,
        isPublic,
        modulesInclus,
      };

      // typePlan uniquement en création (immuable en édition)
      if (!isEditing) {
        body.typePlan = typePlan;
      }

      const url = isEditing ? `/api/plans/${plan!.id}` : "/api/plans";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          const msg = data.message ?? "Erreur serveur.";
          // Message spécifique pour conflit de type (409)
          setErrors([{ field: "global", message: msg }]);
        }
        return;
      }

      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.plans() });
      if (onSuccess) onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* R5 : DialogTrigger asChild — obligatoire */}
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le plan" : "Créer un plan d'abonnement"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez les propriétés du plan. Le type de plan est immuable."
              : "Créez un nouveau plan d'abonnement pour vos clients."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Erreur globale */}
          {getError("global") && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {getError("global")}
            </div>
          )}

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nom <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Plan Éleveur Standard"
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {getError("nom") && (
              <p className="text-destructive text-xs mt-1">{getError("nom")}</p>
            )}
          </div>

          {/* Type de plan — désactivé en mode édition */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Type de plan <span className="text-destructive">*</span>
            </label>
            <select
              value={typePlan}
              onChange={(e) => setTypePlan(e.target.value as TypePlan)}
              disabled={isEditing}
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {TYPE_PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-1">
                Le type de plan ne peut pas être modifié après création.
              </p>
            )}
            {getError("typePlan") && (
              <p className="text-destructive text-xs mt-1">{getError("typePlan")}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description visible sur la page de tarification"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Prix */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Tarifs (en XAF — laisser vide si non disponible)
            </legend>

            {/* Prix mensuel */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Prix mensuel
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={prixMensuel}
                  onChange={(e) => setPrixMensuel(e.target.value)}
                  min="0"
                  step="100"
                  placeholder="Ex: 3000"
                  className="w-full h-11 px-3 pr-16 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  XAF/mois
                </span>
              </div>
              {getError("prixMensuel") && (
                <p className="text-destructive text-xs mt-1">{getError("prixMensuel")}</p>
              )}
            </div>

            {/* Prix trimestriel */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Prix trimestriel
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={prixTrimestriel}
                  onChange={(e) => setPrixTrimestriel(e.target.value)}
                  min="0"
                  step="100"
                  placeholder="Ex: 7500"
                  className="w-full h-11 px-3 pr-16 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  XAF/trim.
                </span>
              </div>
              {getError("prixTrimestriel") && (
                <p className="text-destructive text-xs mt-1">{getError("prixTrimestriel")}</p>
              )}
            </div>

            {/* Prix annuel */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Prix annuel
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={prixAnnuel}
                  onChange={(e) => setPrixAnnuel(e.target.value)}
                  min="0"
                  step="100"
                  placeholder="Ex: 25000"
                  className="w-full h-11 px-3 pr-14 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  XAF/an
                </span>
              </div>
              {getError("prixAnnuel") && (
                <p className="text-destructive text-xs mt-1">{getError("prixAnnuel")}</p>
              )}
            </div>
          </fieldset>

          {/* Limites */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Limites (999 = illimité)
            </legend>

            <div className="grid grid-cols-3 gap-3">
              {/* Limite sites */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Sites max
                </label>
                <input
                  type="number"
                  value={limitesSites}
                  onChange={(e) => setLimitesSites(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {getError("limitesSites") && (
                  <p className="text-destructive text-xs mt-1">{getError("limitesSites")}</p>
                )}
              </div>

              {/* Limite bacs */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Bacs max
                </label>
                <input
                  type="number"
                  value={limitesBacs}
                  onChange={(e) => setLimitesBacs(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {getError("limitesBacs") && (
                  <p className="text-destructive text-xs mt-1">{getError("limitesBacs")}</p>
                )}
              </div>

              {/* Limite vagues */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Vagues max
                </label>
                <input
                  type="number"
                  value={limitesVagues}
                  onChange={(e) => setLimitesVagues(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {getError("limitesVagues") && (
                  <p className="text-destructive text-xs mt-1">{getError("limitesVagues")}</p>
                )}
              </div>
            </div>

            {/* Limite fermes ingénieur — visible seulement pour les types INGENIEUR_* */}
            {isIngenieurType && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Fermes ingénieur max (optionnel)
                </label>
                <input
                  type="number"
                  value={limitesIngFermes}
                  onChange={(e) => setLimitesIngFermes(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="Ex: 5"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {getError("limitesIngFermes") && (
                  <p className="text-destructive text-xs mt-1">{getError("limitesIngFermes")}</p>
                )}
              </div>
            )}
          </fieldset>

          {/* Modules inclus */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              {t("admin.modulesInclus")}
            </legend>
            <p className="text-xs text-muted-foreground">
              {t("admin.modulesHelp")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SITE_TOGGLEABLE_MODULES.map((mod) => {
                const navKey = getModuleNavKey(mod.value);
                const label = tNav(navKey as Parameters<typeof tNav>[0]);
                const checked = modulesInclus.includes(mod.value);
                const checkboxId = `module-${mod.value}`;
                const Icon = mod.icon;
                return (
                  <label
                    key={mod.value}
                    htmlFor={checkboxId}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors select-none ${
                      checked
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(mod.value)}
                      className="h-4 w-4 rounded border-border accent-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 flex-shrink-0"
                    />
                    <Icon className={`h-4 w-4 flex-shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                    <span className="text-sm font-medium leading-none">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            {/* isActif */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Plan actif</p>
                <p className="text-xs text-muted-foreground">
                  Un plan inactif ne peut pas être souscrit.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActif}
                onClick={() => setIsActif((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  isActif ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    isActif ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* isPublic */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Plan public</p>
                <p className="text-xs text-muted-foreground">
                  Un plan privé est visible uniquement via lien direct.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  isPublic ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    isPublic ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </form>

        <DialogFooter className="gap-2 mt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 sm:flex-none px-4 min-h-[44px] bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 min-h-[44px] bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Enregistrement..." : isEditing ? "Enregistrer" : "Créer le plan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
