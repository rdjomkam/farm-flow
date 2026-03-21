"use client";
/**
 * src/components/commissions/admin-retraits-list.tsx
 *
 * Liste des retraits pour l'administrateur DKFarm.
 * - Retraits EN_ATTENTE en haut avec bouton "Traiter"
 * - Historique des retraits traités en dessous
 *
 * Story 34.4 — Sprint 34
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatutPaiementAbo } from "@/types";

interface RetraitAdmin {
  id: string;
  montant: number;
  fournisseur: string;
  phoneNumber: string;
  statut: string;
  referenceExterne?: string | null;
  createdAt: Date | string;
  dateTraitement?: Date | string | null;
  portefeuille: {
    ingenieur: {
      id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
    };
    solde: number;
  };
  demandeur: { id: string; name: string };
  traiteur?: { id: string; name: string } | null;
}

interface AdminRetraitsListProps {
  retraitsDemandes: RetraitAdmin[];
  retraitsTraites: RetraitAdmin[];
}

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-CM", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ---------------------------------------------------------------------------
// TraiterDialog — Dialog de traitement d'un retrait
// ---------------------------------------------------------------------------

interface TraiterDialogProps {
  retrait: RetraitAdmin;
}

function TraiterDialog({ retrait }: TraiterDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [statut, setStatut] = useState<"CONFIRME" | "ECHEC">("CONFIRME");

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setError(null);
      setReference("");
      setStatut("CONFIRME");
    }
  }

  async function handleTraiter() {
    if (!reference.trim()) {
      setError("La référence de virement est obligatoire.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portefeuille/retrait/${retrait.id}/traiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, referenceExterne: reference.trim() }),
      });
      const data = await response.json() as { status?: number; message?: string };
      if (!response.ok) {
        setError(data.message ?? "Erreur lors du traitement.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* R5 : DialogTrigger asChild */}
      <DialogTrigger asChild>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          Traiter
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Traiter le retrait</DialogTitle>
          <DialogDescription>
            {retrait.portefeuille.ingenieur.name} — {formatXAF(retrait.montant)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </p>
          )}

          {/* Récapitulatif du retrait */}
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ingénieur</span>
              <span className="font-medium">{retrait.portefeuille.ingenieur.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-semibold">{formatXAF(retrait.montant)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vers</span>
              <span className="font-medium">{retrait.phoneNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Via</span>
              <span className="font-medium">{retrait.fournisseur.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Demandé le</span>
              <span>{formatDate(retrait.createdAt)}</span>
            </div>
          </div>

          {/* Statut */}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="statut-traitement">
              Résultat du traitement
            </label>
            <select
              id="statut-traitement"
              value={statut}
              onChange={(e) => setStatut(e.target.value as "CONFIRME" | "ECHEC")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="CONFIRME">Confirmé (virement effectué)</option>
              <option value="ECHEC">Échoué (rembourser le solde)</option>
            </select>
          </div>

          {/* Référence de virement */}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="reference-virement">
              Référence de virement <span className="text-destructive">*</span>
            </label>
            <input
              id="reference-virement"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: MTN20260328XXXXX"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleTraiter}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Traitement..." : "Confirmer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AdminRetraitsList
// ---------------------------------------------------------------------------

const STATUT_COLORS: Record<string, string> = {
  [StatutPaiementAbo.EN_ATTENTE]: "bg-warning/10 text-warning",
  [StatutPaiementAbo.CONFIRME]: "bg-success/10 text-success",
  [StatutPaiementAbo.ECHEC]: "bg-destructive/10 text-destructive",
};

const STATUT_LABELS: Record<string, string> = {
  [StatutPaiementAbo.EN_ATTENTE]: "En attente",
  [StatutPaiementAbo.CONFIRME]: "Confirmé",
  [StatutPaiementAbo.ECHEC]: "Échoué",
};

export function AdminRetraitsList({ retraitsDemandes, retraitsTraites }: AdminRetraitsListProps) {
  return (
    <div className="space-y-6">
      {/* Section : Retraits en attente */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Retraits en attente ({retraitsDemandes.length})
        </h2>
        {retraitsDemandes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm rounded-xl border border-border bg-card">
            Aucun retrait en attente de traitement.
          </div>
        ) : (
          <div className="space-y-3">
            {retraitsDemandes.map((retrait) => (
              <div
                key={retrait.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm">
                      {retrait.portefeuille.ingenieur.name}
                    </p>
                    {(retrait.portefeuille.ingenieur.phone ?? retrait.portefeuille.ingenieur.email) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {retrait.portefeuille.ingenieur.phone ?? retrait.portefeuille.ingenieur.email}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Vers : {retrait.phoneNumber} ({retrait.fournisseur.replace("_", " ")})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Demandé le {formatDate(retrait.createdAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-2">
                    <p className="text-base font-bold text-foreground">
                      {formatXAF(retrait.montant)}
                    </p>
                    <TraiterDialog retrait={retrait} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section : Historique des retraits traités */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Historique des retraits traités
        </h2>
        {retraitsTraites.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm rounded-xl border border-border bg-card">
            Aucun retrait traité pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {retraitsTraites.map((retrait) => (
              <div
                key={retrait.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm">
                      {retrait.portefeuille.ingenieur.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vers : {retrait.phoneNumber}
                    </p>
                    {retrait.referenceExterne && (
                      <p className="text-xs text-muted-foreground">
                        Réf. : {retrait.referenceExterne}
                      </p>
                    )}
                    {retrait.traiteur && (
                      <p className="text-xs text-muted-foreground">
                        Traité par {retrait.traiteur.name}
                      </p>
                    )}
                    {retrait.dateTraitement && (
                      <p className="text-xs text-muted-foreground">
                        Le {formatDate(retrait.dateTraitement)}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-foreground">
                      {formatXAF(retrait.montant)}
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        STATUT_COLORS[retrait.statut] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUT_LABELS[retrait.statut] ?? retrait.statut}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
