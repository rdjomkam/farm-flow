"use client";

/**
 * src/components/abonnements/abonnements-admin-list.tsx
 *
 * Liste admin de tous les abonnements avec filtres et actions.
 * Client Component — filtres interactifs.
 * Mobile-first : cartes empilées sur mobile, tableau sur desktop.
 *
 * Story 33.4 — Sprint 33
 * R2 : enums importés depuis @/types
 * R5 : DialogTrigger asChild sur les dialogs d'action
 * R6 : CSS variables du thème
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatutAbonnement, PeriodeFacturation } from "@/types";
import type { PlanAbonnement } from "@/types";
import { PLAN_LABELS, STATUT_ABONNEMENT_LABELS, PERIODE_LABELS } from "@/lib/abonnements-constants";
import { formatXAF } from "@/lib/format";

interface AbonnementAdminItem {
  id: string;
  siteId: string;
  planId: string;
  periode: PeriodeFacturation;
  statut: StatutAbonnement;
  dateDebut: Date;
  dateFin: Date;
  prixPaye: number;
  createdAt: Date;
  plan: Pick<PlanAbonnement, "id" | "nom" | "typePlan">;
  site: { id: string; name: string };
}

interface PlanOption {
  id: string;
  nom: string;
  typePlan: import("@/types").TypePlan;
}

interface AbonnementsAdminListProps {
  abonnements: AbonnementAdminItem[];
  plans: PlanOption[];
  currentPage: number;
  totalPages: number;
  total: number;
  currentStatut: StatutAbonnement | null;
  currentPlanId: string | null;
}

function statutVariant(
  statut: StatutAbonnement
): "en_cours" | "terminee" | "annulee" | "warning" | "default" {
  switch (statut) {
    case StatutAbonnement.ACTIF:
      return "terminee";
    case StatutAbonnement.EN_GRACE:
      return "warning";
    case StatutAbonnement.SUSPENDU:
    case StatutAbonnement.EXPIRE:
    case StatutAbonnement.ANNULE:
      return "annulee";
    default:
      return "default";
  }
}

export function AbonnementsAdminList({
  abonnements,
  plans,
  currentPage,
  totalPages,
  total,
  currentStatut,
  currentPlanId,
}: AbonnementsAdminListProps) {
  const router = useRouter();
  const [annulationId, setAnnulationId] = useState<string | null>(null);
  const [annulationLoading, setAnnulationLoading] = useState(false);
  const [annulationError, setAnnulationError] = useState<string | null>(null);
  const [activationId, setActivationId] = useState<string | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);

  function buildUrl(params: Record<string, string | null>) {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    });
    return url.pathname + url.search;
  }

  async function handleAnnuler(id: string) {
    setAnnulationLoading(true);
    setAnnulationError(null);
    try {
      const res = await fetch(`/api/abonnements/${id}/annuler`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setAnnulationError(data.message ?? "Impossible d'annuler.");
        return;
      }
      setAnnulationId(null);
      router.refresh();
    } catch {
      setAnnulationError("Erreur réseau.");
    } finally {
      setAnnulationLoading(false);
    }
  }

  async function handleForceActivation(id: string) {
    setActivationLoading(true);
    try {
      const res = await fetch(`/api/abonnements/${id}/renouveler`, { method: "POST" });
      if (res.ok) {
        setActivationId(null);
        router.refresh();
      }
    } catch {
      // silencieux
    } finally {
      setActivationLoading(false);
    }
  }

  const validStatuts = Object.values(StatutAbonnement);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground min-h-[40px]"
          value={currentStatut ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            router.push(buildUrl({ statut: val || null, page: "1" }));
          }}
        >
          <option value="">Tous les statuts</option>
          {validStatuts.map((s) => (
            <option key={s} value={s}>
              {STATUT_ABONNEMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground min-h-[40px]"
          value={currentPlanId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            router.push(buildUrl({ planId: val || null, page: "1" }));
          }}
        >
          <option value="">Tous les plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {PLAN_LABELS[p.typePlan]}
            </option>
          ))}
        </select>
        {(currentStatut || currentPlanId) && (
          <Button
            variant="outline"
            className="text-xs min-h-[40px]"
            onClick={() => router.push(buildUrl({ statut: null, planId: null, page: "1" }))}
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Tableau desktop */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Site</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Période</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Début</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fin</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {abonnements.map((a, i) => (
              <tr key={a.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                <td className="px-4 py-3 font-medium text-foreground">{a.site.name}</td>
                <td className="px-4 py-3 text-foreground">{PLAN_LABELS[a.plan.typePlan]}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={statutVariant(a.statut)}
                    aria-label={`Statut : ${STATUT_ABONNEMENT_LABELS[a.statut]}`}
                  >
                    {STATUT_ABONNEMENT_LABELS[a.statut]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{PERIODE_LABELS[a.periode]}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(a.dateDebut).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(a.dateFin).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatXAF(a.prixPaye)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    {/* Forcer activation */}
                    {(a.statut === StatutAbonnement.EN_ATTENTE_PAIEMENT || a.statut === StatutAbonnement.EN_GRACE) && (
                      <Dialog open={activationId === a.id} onOpenChange={(open) => !open && setActivationId(null)}>
                        {/* R5 : DialogTrigger asChild */}
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-8 px-2 text-xs gap-1"
                            onClick={() => setActivationId(a.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Activer
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Forcer l&apos;activation</DialogTitle>
                            <DialogDescription>
                              Activer manuellement l&apos;abonnement pour le site{" "}
                              <strong>{a.site.name}</strong> ?
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setActivationId(null)} className="min-h-[44px]">
                              Annuler
                            </Button>
                            <Button
                              onClick={() => handleForceActivation(a.id)}
                              disabled={activationLoading}
                              className="min-h-[44px]"
                            >
                              {activationLoading ? "Activation..." : "Confirmer"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {/* Annuler */}
                    {a.statut === StatutAbonnement.ACTIF && (
                      <Dialog
                        open={annulationId === a.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setAnnulationId(null);
                            setAnnulationError(null);
                          }
                        }}
                      >
                        {/* R5 : DialogTrigger asChild */}
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-8 px-2 text-xs gap-1 text-danger border-danger/30 hover:bg-danger/10"
                            onClick={() => setAnnulationId(a.id)}
                          >
                            <AlertCircle className="h-3 w-3" />
                            Annuler
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Annuler l&apos;abonnement</DialogTitle>
                            <DialogDescription>
                              Annuler l&apos;abonnement de <strong>{a.site.name}</strong> ? Cette
                              action est irréversible.
                            </DialogDescription>
                          </DialogHeader>
                          {annulationError && (
                            <p className="text-sm text-danger">{annulationError}</p>
                          )}
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setAnnulationId(null)}
                              className="min-h-[44px]"
                            >
                              Conserver
                            </Button>
                            <Button
                              variant="outline"
                              className="min-h-[44px] text-danger border-danger/30 hover:bg-danger/10"
                              onClick={() => handleAnnuler(a.id)}
                              disabled={annulationLoading}
                            >
                              {annulationLoading ? "Annulation..." : "Confirmer"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {abonnements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Aucun abonnement trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cartes mobile */}
      <div className="space-y-3 md:hidden">
        {abonnements.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Aucun abonnement trouvé.
          </p>
        )}
        {abonnements.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{a.site.name}</p>
                <p className="text-xs text-muted-foreground">{PLAN_LABELS[a.plan.typePlan]}</p>
              </div>
              <Badge
                variant={statutVariant(a.statut)}
                aria-label={`Statut : ${STATUT_ABONNEMENT_LABELS[a.statut]}`}
              >
                {STATUT_ABONNEMENT_LABELS[a.statut]}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Période</p>
                <p className="font-medium text-foreground">{PERIODE_LABELS[a.periode]}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Montant</p>
                <p className="font-medium text-foreground">{formatXAF(a.prixPaye)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Début</p>
                <p className="font-medium text-foreground">{new Date(a.dateDebut).toLocaleDateString("fr-FR")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fin</p>
                <p className="font-medium text-foreground">{new Date(a.dateFin).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages} ({total} résultats)
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildUrl({ page: String(currentPage - 1) })}>
                <Button variant="outline" className="min-h-[44px] gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Préc.
                </Button>
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={buildUrl({ page: String(currentPage + 1) })}>
                <Button variant="outline" className="min-h-[44px] gap-1">
                  Suiv.
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
