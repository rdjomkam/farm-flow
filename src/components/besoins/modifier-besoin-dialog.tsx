"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProduitOption {
  id: string;
  nom: string;
  unite: string;
  prixUnitaire: number;
}

interface LigneBesoinData {
  id: string;
  designation: string;
  produitId: string | null;
  quantite: number;
  unite: string | null;
  prixEstime: number;
  prixReel: number | null;
  commandeId: string | null;
  produit: { id: string; nom: string; unite: string } | null;
  commande: { id: string; numero: string; statut: string } | null;
}

interface ListeBesoinsEditData {
  id: string;
  titre: string;
  notes: string | null;
  dateLimite: string | null;
  vagueId: string | null;
  vague: { id: string; code: string } | null;
  lignes: LigneBesoinData[];
}

interface LigneForm {
  id: string;
  designation: string;
  produitId: string;
  quantite: string;
  unite: string;
  prixEstime: string;
}

interface Props {
  liste: ListeBesoinsEditData;
  onSuccess: (updated: ListeBesoinsEditData) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId() {
  return Math.random().toString(36).slice(2);
}

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function toLigneForm(l: LigneBesoinData): LigneForm {
  return {
    id: genId(),
    designation: l.designation,
    produitId: l.produitId ?? "",
    quantite: String(l.quantite),
    unite: l.unite ?? "",
    prixEstime: String(l.prixEstime),
  };
}

function emptyLigne(): LigneForm {
  return {
    id: genId(),
    designation: "",
    produitId: "",
    quantite: "",
    unite: "",
    prixEstime: "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModifierBesoinDialog({ liste, onSuccess }: Props) {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [produits, setProduits] = useState<ProduitOption[]>([]);
  const [produitsLoading, setProduitsLoading] = useState(false);

  // Form state — initialisé depuis la liste courante
  const [titre, setTitre] = useState(liste.titre);
  const [notes, setNotes] = useState(liste.notes ?? "");
  const [dateLimite, setDateLimite] = useState(
    liste.dateLimite ? new Date(liste.dateLimite).toISOString().split("T")[0] : ""
  );
  const [lignes, setLignes] = useState<LigneForm[]>(
    liste.lignes.length > 0 ? liste.lignes.map(toLigneForm) : [emptyLigne()]
  );

  const montantEstime = lignes.reduce((acc, l) => {
    const q = parseFloat(l.quantite) || 0;
    const p = parseFloat(l.prixEstime) || 0;
    return acc + q * p;
  }, 0);

  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }

  function removeLigne(id: string) {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLigne(id: string, field: keyof LigneForm, value: string) {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Si produit selectionne, auto-fill designation, unite, prixEstime
        if (field === "produitId" && value) {
          const produit = produits.find((p) => p.id === value);
          if (produit) {
            updated.designation = produit.nom;
            updated.unite = produit.unite;
            updated.prixEstime = String(produit.prixUnitaire);
          }
        }
        return updated;
      })
    );
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      // Re-initialiser les valeurs quand on rouvre le dialog
      setTitre(liste.titre);
      setNotes(liste.notes ?? "");
      setDateLimite(
        liste.dateLimite ? new Date(liste.dateLimite).toISOString().split("T")[0] : ""
      );
      setLignes(liste.lignes.length > 0 ? liste.lignes.map(toLigneForm) : [emptyLigne()]);
      // Fetch produits si pas encore charges
      if (produits.length === 0) {
        setProduitsLoading(true);
        fetch("/api/produits")
          .then((res) => (res.ok ? res.json() : { produits: [] }))
          .then((data) => setProduits(Array.isArray(data.produits) ? data.produits : []))
          .catch(() => setProduits([]))
          .finally(() => setProduitsLoading(false));
      }
    }
  }

  async function handleSubmit() {
    // Validation legere
    if (!titre.trim()) {
      toast({ title: "Le titre est obligatoire.", variant: "error" });
      return;
    }
    if (lignes.length === 0) {
      toast({ title: "Au moins une ligne est requise.", variant: "error" });
      return;
    }
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.designation.trim()) {
        toast({
          title: `La designation de la ligne ${i + 1} est obligatoire.`,
          variant: "error",
        });
        return;
      }
      if (!l.quantite || parseFloat(l.quantite) <= 0) {
        toast({
          title: `La quantite de la ligne ${i + 1} doit etre positive.`,
          variant: "error",
        });
        return;
      }
      if (l.prixEstime === "" || parseFloat(l.prixEstime) < 0) {
        toast({
          title: `Le prix estime de la ligne ${i + 1} doit etre positif ou zero.`,
          variant: "error",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/besoins/${liste.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: titre.trim(),
          notes: notes.trim() || null,
          // dateLimite : null = supprimer, valeur = mettre a jour, undefined = ne pas changer
          dateLimite: dateLimite || null,
          lignes: lignes.map((l) => ({
            designation: l.designation.trim(),
            produitId: l.produitId || undefined,
            quantite: parseFloat(l.quantite),
            unite: l.unite.trim() || undefined,
            prixEstime: parseFloat(l.prixEstime) || 0,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur serveur.");
      }

      const data = await res.json();
      toast({ title: "Liste de besoins modifiee", variant: "success" });
      setOpen(false);
      onSuccess(data);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur serveur.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Modifier
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la liste de besoins</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Titre */}
          <div>
            <label className="text-sm font-medium">
              Titre <span className="text-destructive">*</span>
            </label>
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Besoins alimentation mars 2026"
              className="mt-1"
            />
          </div>

          {/* Date limite */}
          <div>
            <label className="text-sm font-medium">Date limite</label>
            <p className="text-xs text-muted-foreground mb-1">
              Date jusqu'a laquelle la liste doit etre traitee (optionnel)
            </p>
            <Input
              type="date"
              value={dateLimite}
              onChange={(e) => setDateLimite(e.target.value)}
              className="mt-1"
            />
            {dateLimite && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline mt-1"
                onClick={() => setDateLimite("")}
              >
                Supprimer la date limite
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complementaires..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Lignes de besoin */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Lignes de besoin <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {lignes.length} ligne{lignes.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-3">
              {lignes.map((l, idx) => (
                <Card key={l.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">
                        Ligne {idx + 1}
                      </p>
                      {lignes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-6 px-1.5"
                          onClick={() => removeLigne(l.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        Produit du catalogue
                      </label>
                      <Select
                        value={l.produitId || "none"}
                        onValueChange={(v) =>
                          updateLigne(l.id, "produitId", v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="mt-0.5 h-9 text-sm w-full">
                          <SelectValue
                            placeholder={
                              produitsLoading
                                ? "Chargement..."
                                : "Selectionner un produit"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Aucun produit --</SelectItem>
                          {produits.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        Designation <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={l.designation}
                        onChange={(e) => updateLigne(l.id, "designation", e.target.value)}
                        placeholder="Ex: Aliment granules 3mm"
                        className="mt-0.5 h-9 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Quantite <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={l.quantite}
                          onChange={(e) => updateLigne(l.id, "quantite", e.target.value)}
                          placeholder="0"
                          className="mt-0.5 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Unite</label>
                        <Input
                          value={l.unite}
                          onChange={(e) => updateLigne(l.id, "unite", e.target.value)}
                          placeholder="kg, litre..."
                          className="mt-0.5 h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        Prix unitaire estime (FCFA){" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={l.prixEstime}
                        onChange={(e) => updateLigne(l.id, "prixEstime", e.target.value)}
                        placeholder="0"
                        className="mt-0.5 h-9 text-sm"
                      />
                    </div>

                    {l.quantite && l.prixEstime && (
                      <p className="text-xs text-muted-foreground text-right">
                        Sous-total :{" "}
                        <span className="font-medium text-foreground">
                          {formatMontant(
                            (parseFloat(l.quantite) || 0) * (parseFloat(l.prixEstime) || 0)
                          )}{" "}
                          FCFA
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={addLigne}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter une ligne
            </Button>

            {/* Total estimé */}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm font-medium">Total estime</span>
              <span className="text-base font-bold">{formatMontant(montantEstime)} FCFA</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              Annuler
            </Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
