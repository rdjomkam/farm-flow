"use client";
/**
 * src/components/remises/remise-form-dialog.tsx
 *
 * Dialog de création et modification d'une remise.
 * - Création : POST /api/remises
 * - Modification : PUT /api/remises/[id]
 *
 * Story 35.3 — Sprint 35
 * R5 : DialogTrigger asChild (géré par le composant parent)
 * R6 : CSS variables du thème
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TypeRemise } from "@/types";

interface RemiseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remise?: {
    id: string;
    nom: string;
    code: string;
    type: string;
    valeur: number;
    estPourcentage: boolean;
    dateDebut: Date | string;
    dateFin: Date | string | null;
    limiteUtilisations: number | null;
  } | null;
  onSuccess: () => void;
}

const TYPES_OPTIONS = [
  { value: TypeRemise.EARLY_ADOPTER, label: "Early Adopter" },
  { value: TypeRemise.SAISONNIERE, label: "Saisonnière" },
  { value: TypeRemise.PARRAINAGE, label: "Parrainage" },
  { value: TypeRemise.COOPERATIVE, label: "Coopérative" },
  { value: TypeRemise.VOLUME, label: "Volume" },
  { value: TypeRemise.MANUELLE, label: "Manuelle" },
];

function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0] ?? "";
}

function generateCodeFromNom(nom: string): string {
  return nom
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 20);
}

export function RemiseFormDialog({ open, onOpenChange, remise, onSuccess }: RemiseFormDialogProps) {
  const isEditing = !!remise;

  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>(TypeRemise.MANUELLE);
  const [valeur, setValeur] = useState("");
  const [estPourcentage, setEstPourcentage] = useState(false);
  const [dateDebut, setDateDebut] = useState(toDateInput(new Date()));
  const [dateFin, setDateFin] = useState("");
  const [limiteUtilisations, setLimiteUtilisations] = useState("");
  const [isGlobale, setIsGlobale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);

  // Réinitialiser le formulaire quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      if (remise) {
        setNom(remise.nom);
        setCode(remise.code);
        setType(remise.type);
        setValeur(String(remise.valeur));
        setEstPourcentage(remise.estPourcentage);
        setDateDebut(toDateInput(remise.dateDebut));
        setDateFin(toDateInput(remise.dateFin));
        setLimiteUtilisations(remise.limiteUtilisations ? String(remise.limiteUtilisations) : "");
      } else {
        setNom("");
        setCode("");
        setType(TypeRemise.MANUELLE);
        setValeur("");
        setEstPourcentage(false);
        setDateDebut(toDateInput(new Date()));
        setDateFin("");
        setLimiteUtilisations("");
        setIsGlobale(false);
      }
      setErrors([]);
    }
  }, [open, remise]);

  // Auto-suggestion du code depuis le nom (mode création uniquement)
  function handleNomChange(val: string) {
    setNom(val);
    if (!isEditing && code === "") {
      setCode(generateCodeFromNom(val));
    }
  }

  function handleCodeChange(val: string) {
    // Forcer majuscules + retirer caractères invalides
    setCode(val.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
  }

  function getError(field: string) {
    return errors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    setErrors([]);

    // Validation côté client
    const clientErrors: { field: string; message: string }[] = [];
    if (!nom.trim()) clientErrors.push({ field: "nom", message: "Le nom est requis." });
    if (!code.trim()) clientErrors.push({ field: "code", message: "Le code est requis." });
    if (!valeur || parseFloat(valeur) <= 0)
      clientErrors.push({ field: "valeur", message: "La valeur doit être positive." });
    if (!dateDebut) clientErrors.push({ field: "dateDebut", message: "La date de début est requise." });
    if (dateFin && dateDebut && dateFin <= dateDebut)
      clientErrors.push({ field: "dateFin", message: "La date de fin doit être après la date de début." });

    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        nom: nom.trim(),
        code: code.trim(),
        type,
        valeur: parseFloat(valeur),
        estPourcentage,
        dateDebut,
        dateFin: dateFin || undefined,
        limiteUtilisations: limiteUtilisations ? parseInt(limiteUtilisations) : undefined,
        isGlobale,
      };

      const url = isEditing ? `/api/remises/${remise!.id}` : "/api/remises";
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
          setErrors([{ field: "global", message: data.message ?? "Erreur serveur." }]);
        }
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier la remise" : "Créer une remise"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez les propriétés de la remise. Le code et le type sont immuables."
              : "Créez un nouveau code promo ou une remise automatique."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Erreur globale */}
          {errors.find((e) => e.field === "global") && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {errors.find((e) => e.field === "global")?.message}
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
              onChange={(e) => handleNomChange(e.target.value)}
              placeholder="Ex: Early Adopter Lancement 2026"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {getError("nom") && (
              <p className="text-destructive text-xs mt-1">{getError("nom")}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Code promo <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              disabled={isEditing}
              placeholder="Ex: EARLY2026"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lettres, chiffres et tirets uniquement. Automatiquement en majuscules.
            </p>
            {getError("code") && (
              <p className="text-destructive text-xs mt-1">{getError("code")}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Type <span className="text-destructive">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isEditing}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {TYPES_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Valeur + type (% ou XAF) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">
                Valeur <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                min="0.01"
                step="1"
                placeholder={estPourcentage ? "Ex: 10" : "Ex: 2000"}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {getError("valeur") && (
                <p className="text-destructive text-xs mt-1">{getError("valeur")}</p>
              )}
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-foreground mb-1">
                Unité
              </label>
              <select
                value={estPourcentage ? "pct" : "xaf"}
                onChange={(e) => setEstPourcentage(e.target.value === "pct")}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="xaf">XAF fixe</option>
                <option value="pct">% remise</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">
                Début <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {getError("dateDebut") && (
                <p className="text-destructive text-xs mt-1">{getError("dateDebut")}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">
                Fin (optionnel)
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {getError("dateFin") && (
                <p className="text-destructive text-xs mt-1">{getError("dateFin")}</p>
              )}
            </div>
          </div>

          {/* Limite d'utilisations */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Limite d&apos;utilisations (optionnel)
            </label>
            <input
              type="number"
              value={limiteUtilisations}
              onChange={(e) => setLimiteUtilisations(e.target.value)}
              min="1"
              step="1"
              placeholder="Illimité si vide"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Remise globale (création uniquement) */}
          {!isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isGlobale"
                checked={isGlobale}
                onChange={(e) => setIsGlobale(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="isGlobale" className="text-sm text-foreground cursor-pointer">
                Remise globale (applicable à tous les sites)
              </label>
            </div>
          )}
        </form>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : isEditing ? "Enregistrer" : "Créer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
