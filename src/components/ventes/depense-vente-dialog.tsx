"use client";

/**
 * DepenseVenteDialog — Dialog pour ajouter OU modifier une dépense associée à une vente.
 *
 * Mode création : POST /api/ventes/[venteId]/depenses
 * Mode édition  : PUT /api/depenses/[existingDepense.id]
 * Invalide la query React Query du détail vente après succès + reload page.
 *
 * Règles :
 * - R2 : CategorieDepense depuis @/types
 * - R5 : DialogTrigger asChild
 * - R6 : couleurs via className Tailwind (text-destructive, text-success, etc.)
 * - Mobile first
 */

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CategorieDepense } from "@/types";
import { queryKeys } from "@/lib/query-keys";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES: CategorieDepense[] = [
  CategorieDepense.TRANSPORT,
  CategorieDepense.INTRANT,
  CategorieDepense.EQUIPEMENT,
  CategorieDepense.ELECTRICITE,
  CategorieDepense.EAU,
  CategorieDepense.LOYER,
  CategorieDepense.SALAIRE,
  CategorieDepense.VETERINAIRE,
  CategorieDepense.REPARATION,
  CategorieDepense.INVESTISSEMENT,
  CategorieDepense.AUTRE,
];

const CATEGORIE_LABELS: Record<CategorieDepense, string> = {
  [CategorieDepense.ALIMENT]: "Alimentation",
  [CategorieDepense.INTRANT]: "Intrants",
  [CategorieDepense.EQUIPEMENT]: "Equipements",
  [CategorieDepense.ELECTRICITE]: "Electricite",
  [CategorieDepense.EAU]: "Eau",
  [CategorieDepense.LOYER]: "Loyer",
  [CategorieDepense.SALAIRE]: "Salaire",
  [CategorieDepense.TRANSPORT]: "Transport",
  [CategorieDepense.VETERINAIRE]: "Veterinaire",
  [CategorieDepense.REPARATION]: "Reparation",
  [CategorieDepense.INVESTISSEMENT]: "Investissement",
  [CategorieDepense.AUTRE]: "Autre",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExistingDepense {
  id: string;
  description: string;
  montantTotal: number;
  categorieDepense: string;
  date: string | Date;
}

interface DepenseVenteDialogProps {
  venteId: string;
  /** Mode édition : si fourni, le dialog charge les valeurs et fait un PUT */
  existingDepense?: ExistingDepense;
  /** Trigger personnalisable (par défaut = bouton "Ajouter" avec icône Plus) */
  trigger?: React.ReactNode;
  /** Callback après succès */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function DepenseVenteDialog({
  venteId,
  existingDepense,
  trigger,
  onSuccess,
}: DepenseVenteDialogProps) {
  const isEdit = !!existingDepense;
  const t = useTranslations("ventes.depenses");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — initialisé vide, rempli via effect quand on entre en mode édition
  const [description, setDescription] = useState("");
  const [montantTotal, setMontantTotal] = useState("");
  const [categorie, setCategorie] = useState<CategorieDepense | "">("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Pré-remplir le formulaire en mode édition à l'ouverture
  useEffect(() => {
    if (open && isEdit && existingDepense) {
      setDescription(existingDepense.description);
      setMontantTotal(String(existingDepense.montantTotal));
      setCategorie(existingDepense.categorieDepense as CategorieDepense);
      const d = existingDepense.date instanceof Date
        ? existingDepense.date
        : new Date(existingDepense.date);
      setDate(d.toISOString().slice(0, 10));
      setError(null);
    }
  }, [open, isEdit, existingDepense]);

  function resetForm() {
    setDescription("");
    setMontantTotal("");
    setCategorie("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !montantTotal || !categorie || !date) return;

    const montant = parseFloat(montantTotal);
    if (isNaN(montant) || montant <= 0) {
      setError("Montant invalide");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let res: Response;

      if (isEdit && existingDepense) {
        // Mode édition : PUT /api/depenses/[id]
        // On envoie aussi montantPaye = montant pour rester cohérent avec la création
        // (les dépenses de vente sont considérées payées intégralement) et éviter
        // l'erreur "montantTotal < montantPaye" si l'utilisateur réduit le montant.
        res = await fetch(`/api/depenses/${existingDepense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim(),
            montantTotal: montant,
            montantPaye: montant,
            categorieDepense: categorie,
            date,
          }),
        });
      } else {
        // Mode création : POST /api/ventes/[venteId]/depenses
        res = await fetch(`/api/ventes/${venteId}/depenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim(),
            montantTotal: montant,
            categorieDepense: categorie,
            date,
            montantPaye: montant,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (isEdit ? t("form.errorEdit") : t("form.errorAdd")));
        return;
      }

      toast({
        title: isEdit ? t("form.successEdit") : t("form.successAdd"),
        variant: "success",
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.detail(venteId) });
      setOpen(false);
      if (!isEdit) resetForm();
      onSuccess?.();
      // Reload page data (server component)
      window.location.reload();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  const isValid =
    description.trim().length > 0 &&
    parseFloat(montantTotal) > 0 &&
    categorie !== "" &&
    date.length > 0;

  const defaultTrigger = (
    <Button size="sm" variant="outline" className="h-8 gap-1">
      <Plus className="h-3.5 w-3.5" />
      {t("add")}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && !isEdit) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editTitle") : t("form.title")}
          </DialogTitle>
          <DialogDescription>
            {t("empty")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("form.description")}</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
              required
            />
          </div>

          {/* Montant */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("form.montantTotal")}</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={montantTotal}
              onChange={(e) => setMontantTotal(e.target.value)}
              placeholder="Ex: 5000"
              required
            />
          </div>

          {/* Catégorie */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("form.categorie")}</label>
            <Select
              value={categorie}
              onValueChange={(v) => setCategorie(v as CategorieDepense)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORIE_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("form.date")}</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("form.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={loading || !isValid}
              className="min-h-[44px]"
            >
              {loading ? "..." : (isEdit ? t("form.editSubmit") : t("form.submit"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
