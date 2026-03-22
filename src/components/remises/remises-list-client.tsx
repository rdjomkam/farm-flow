"use client";
/**
 * src/components/remises/remises-list-client.tsx
 *
 * Liste des remises pour l'administrateur avec tabs Actives / Expirées / Toutes.
 * - Toggle actif/inactif (optimistic update)
 * - Boutons Modifier et Supprimer par carte
 *
 * Story 35.3 — Sprint 35
 * R5 : DialogTrigger asChild sur les dialogs de suppression
 * R6 : CSS variables du thème (pas de couleurs hardcodées)
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RemiseFormDialog } from "./remise-form-dialog";
import { TypeRemise } from "@/types";

interface RemiseItem {
  id: string;
  nom: string;
  code: string;
  type: string;
  valeur: number;
  estPourcentage: boolean;
  dateDebut: Date | string;
  dateFin: Date | string | null;
  limiteUtilisations: number | null;
  nombreUtilisations: number;
  isActif: boolean;
  siteId: string | null;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  user: { id: string; name: string };
}

interface RemisesListClientProps {
  remises: RemiseItem[];
}

const TYPE_LABELS: Record<string, string> = {
  [TypeRemise.EARLY_ADOPTER]: "Early Adopter",
  [TypeRemise.SAISONNIERE]: "Saisonnière",
  [TypeRemise.PARRAINAGE]: "Parrainage",
  [TypeRemise.COOPERATIVE]: "Coopérative",
  [TypeRemise.VOLUME]: "Volume",
  [TypeRemise.MANUELLE]: "Manuelle",
};

const TYPE_COLORS: Record<string, string> = {
  [TypeRemise.EARLY_ADOPTER]: "bg-emerald-100 text-emerald-800",
  [TypeRemise.SAISONNIERE]: "bg-sky-100 text-sky-800",
  [TypeRemise.PARRAINAGE]: "bg-violet-100 text-violet-800",
  [TypeRemise.COOPERATIVE]: "bg-amber-100 text-amber-800",
  [TypeRemise.VOLUME]: "bg-blue-100 text-blue-800",
  [TypeRemise.MANUELLE]: "bg-slate-100 text-slate-800",
};

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatValeur(valeur: number, estPourcentage: boolean): string {
  if (estPourcentage) return `${valeur}%`;
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valeur);
}

function isExpired(remise: RemiseItem): boolean {
  if (!remise.dateFin) return false;
  return new Date(remise.dateFin) < new Date();
}

export function RemisesListClient({ remises: initialRemises }: RemisesListClientProps) {
  const queryClient = useQueryClient();
  const [remises, setRemises] = useState(initialRemises);
  const [activeTab, setActiveTab] = useState<"actives" | "expirees" | "toutes">("actives");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<RemiseItem | null>(null);
  const [editingRemise, setEditingRemise] = useState<RemiseItem | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  // Filtrage selon le tab
  const filteredRemises = remises.filter((r) => {
    if (activeTab === "actives") return r.isActif && !isExpired(r);
    if (activeTab === "expirees") return isExpired(r) || !r.isActif;
    return true;
  });

  async function handleToggle(remise: RemiseItem) {
    if (togglingId) return;
    setTogglingId(remise.id);

    // Optimistic update
    setRemises((prev) =>
      prev.map((r) => (r.id === remise.id ? { ...r, isActif: !r.isActif } : r))
    );

    try {
      const res = await fetch(`/api/remises/${remise.id}/toggle`, { method: "PATCH" });
      if (!res.ok) {
        // Revenir à l'état précédent si erreur
        setRemises((prev) =>
          prev.map((r) => (r.id === remise.id ? { ...r, isActif: remise.isActif } : r))
        );
      }
    } catch {
      // Revenir à l'état précédent
      setRemises((prev) =>
        prev.map((r) => (r.id === remise.id ? { ...r, isActif: remise.isActif } : r))
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!selectedForDelete) return;
    setDeletingId(selectedForDelete.id);

    try {
      const res = await fetch(`/api/remises/${selectedForDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setRemises((prev) => prev.filter((r) => r.id !== selectedForDelete.id));
        setDeleteDialogOpen(false);
        setSelectedForDelete(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(remise: RemiseItem) {
    setEditingRemise(remise);
    setFormDialogOpen(true);
  }

  function handleCreate() {
    setEditingRemise(null);
    setFormDialogOpen(true);
  }

  function handleSaveSuccess() {
    setFormDialogOpen(false);
    setEditingRemise(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.remises.all });
  }

  return (
    <div className="space-y-4">
      {/* Header avec bouton créer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["actives", "expirees", "toutes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab === "actives" ? "Actives" : tab === "expirees" ? "Expirées" : "Toutes"}
              <span className="ml-1.5 text-xs opacity-70">
                (
                {tab === "actives"
                  ? remises.filter((r) => r.isActif && !isExpired(r)).length
                  : tab === "expirees"
                  ? remises.filter((r) => isExpired(r) || !r.isActif).length
                  : remises.length}
                )
              </span>
            </button>
          ))}
        </div>
        {/* R5 : pas de DialogTrigger ici — on gère l'état manuellement */}
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Nouvelle remise
        </button>
      </div>

      {/* Liste des remises */}
      {filteredRemises.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucune remise dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRemises.map((remise) => (
            <div
              key={remise.id}
              className={`rounded-xl border border-border bg-card p-4 transition-opacity ${
                !remise.isActif ? "opacity-60" : ""
              }`}
            >
              {/* Ligne principale */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Code promo — en gros, copiable */}
                  <button
                    onClick={() => navigator.clipboard.writeText(remise.code)}
                    className="font-mono text-lg font-bold text-foreground hover:text-primary transition-colors cursor-copy"
                    title="Copier le code"
                  >
                    {remise.code}
                  </button>
                  <p className="text-sm text-muted-foreground mt-0.5">{remise.nom}</p>
                </div>

                {/* Valeur */}
                <div className="text-right flex-shrink-0">
                  <span className="text-xl font-bold text-foreground">
                    {formatValeur(remise.valeur, remise.estPourcentage)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {remise.estPourcentage ? "réduction" : "XAF fixe"}
                  </p>
                </div>
              </div>

              {/* Badges et infos */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {/* Badge type */}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    TYPE_COLORS[remise.type] ?? "bg-slate-100 text-slate-800"
                  }`}
                >
                  {TYPE_LABELS[remise.type] ?? remise.type}
                </span>

                {/* Badge global ou site */}
                {remise.siteId === null && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Globale
                  </span>
                )}

                {/* Utilisations */}
                <span className="text-xs text-muted-foreground">
                  {remise.nombreUtilisations}
                  {remise.limiteUtilisations !== null
                    ? `/${remise.limiteUtilisations}`
                    : ""}{" "}
                  utilisation{remise.nombreUtilisations > 1 ? "s" : ""}
                </span>

                {/* Date fin */}
                {remise.dateFin && (
                  <span
                    className={`text-xs ${
                      isExpired(remise) ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    Expire le {formatDate(remise.dateFin)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                {/* Toggle actif */}
                <button
                  onClick={() => handleToggle(remise)}
                  disabled={togglingId === remise.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    remise.isActif
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      remise.isActif ? "bg-emerald-500" : "bg-muted-foreground"
                    }`}
                  />
                  {togglingId === remise.id
                    ? "..."
                    : remise.isActif
                    ? "Active"
                    : "Inactive"}
                </button>

                <button
                  onClick={() => handleEdit(remise)}
                  className="px-3 py-1.5 bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg text-xs font-medium transition-colors"
                >
                  Modifier
                </button>

                {/* R5 : DialogTrigger asChild pour le bouton Supprimer */}
                <Dialog
                  open={deleteDialogOpen && selectedForDelete?.id === remise.id}
                  onOpenChange={(open) => {
                    if (!open) {
                      setDeleteDialogOpen(false);
                      setSelectedForDelete(null);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <button
                      onClick={() => {
                        setSelectedForDelete(remise);
                        setDeleteDialogOpen(true);
                      }}
                      className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      Supprimer
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Supprimer la remise</DialogTitle>
                      <DialogDescription>
                        {remise.nombreUtilisations > 0
                          ? `Cette remise a été utilisée ${remise.nombreUtilisations} fois. Elle sera désactivée (pas supprimée).`
                          : `Êtes-vous sûr de vouloir supprimer le code "${remise.code}" ? Cette action est irréversible.`}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <button
                        onClick={() => {
                          setDeleteDialogOpen(false);
                          setSelectedForDelete(null);
                        }}
                        className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deletingId === remise.id}
                        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {deletingId === remise.id
                          ? "..."
                          : remise.nombreUtilisations > 0
                          ? "Désactiver"
                          : "Supprimer"}
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de création/modification */}
      <RemiseFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        remise={editingRemise}
        onSuccess={handleSaveSuccess}
      />
    </div>
  );
}
