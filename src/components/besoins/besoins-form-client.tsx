"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useDepenseService } from "@/services";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VagueOption {
  id: string;
  code: string;
}

interface ProduitOption {
  id: string;
  nom: string;
  unite: string;
  prixUnitaire: number;
}

interface LigneForm {
  id: string; // local only
  designation: string;
  produitId: string;
  quantite: string;
  unite: string;
  prixEstime: string;
}

interface Props {
  vagues: VagueOption[];
  produits: ProduitOption[];
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

export function BesoinsFormClient({ vagues, produits }: Props) {
  const router = useRouter();
  const depenseService = useDepenseService();

  const [titre, setTitre] = useState("");
  const [vagueId, setVagueId] = useState("");
  const [notes, setNotes] = useState("");
  const [dateLimite, setDateLimite] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([emptyLigne()]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Calculated montantEstime
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: string[] = [];

    if (!titre.trim()) {
      errors.push("Le titre est obligatoire.");
    }

    if (lignes.length === 0) {
      errors.push("La liste doit contenir au moins une ligne.");
    }

    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.designation.trim()) {
        errors.push(`La designation de la ligne ${i + 1} est obligatoire.`);
      }
      if (!l.quantite || parseFloat(l.quantite) <= 0) {
        errors.push(
          `La quantite de la ligne ${i + 1} doit etre un nombre positif.`
        );
      }
      if (l.prixEstime === "" || parseFloat(l.prixEstime) < 0) {
        errors.push(
          `Le prix estime de la ligne ${i + 1} doit etre un nombre positif ou zero.`
        );
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);

    const result = await depenseService.createBesoin({
      titre: titre.trim(),
      vagueId: vagueId || undefined,
      notes: notes.trim() || undefined,
      dateLimite: dateLimite || undefined,
      lignes: lignes.map((l) => ({
        designation: l.designation.trim(),
        produitId: l.produitId || undefined,
        quantite: parseFloat(l.quantite),
        unite: l.unite.trim() || undefined,
        prixEstime: parseFloat(l.prixEstime) || 0,
      })),
    });

    if (result.ok && result.data) {
      router.push(`/besoins/${result.data.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 pb-24 max-w-2xl mx-auto">
      {/* Back nav */}
      <Link
        href="/besoins"
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux besoins
      </Link>

      {/* Champs principaux */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">
              Titre <span className="text-destructive">*</span>
            </label>
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Besoins alimentation mars 2026"
              className="mt-1"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Vague associee</label>
            <Select
              value={vagueId}
              onValueChange={(v) => setVagueId(v === "none" ? "" : v)}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Selectionnez une vague (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Aucune vague --</SelectItem>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div>
            <label className="text-sm font-medium">Date limite</label>
            <p className="text-xs text-muted-foreground mb-1">
              Date jusqu&apos;a laquelle la liste doit etre traitee (optionnel)
            </p>
            <Input
              type="date"
              value={dateLimite}
              onChange={(e) => setDateLimite(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lignes de besoin */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Lignes de besoin</h2>
        <span className="text-sm text-muted-foreground">
          {lignes.length} ligne{lignes.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3 mb-3">
        {lignes.map((l, idx) => (
          <Card key={l.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Ligne {idx + 1}
                </p>
                {lignes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-7 px-2"
                    onClick={() => removeLigne(l.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Produit (optionnel) */}
              <div>
                <label className="text-xs text-muted-foreground">
                  Produit en stock (optionnel)
                </label>
                <Select
                  value={l.produitId}
                  onValueChange={(v) =>
                    updateLigne(l.id, "produitId", v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Selectionner un produit" />
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

              {/* Designation */}
              <div>
                <label className="text-xs text-muted-foreground">
                  Designation <span className="text-destructive">*</span>
                </label>
                <Input
                  value={l.designation}
                  onChange={(e) =>
                    updateLigne(l.id, "designation", e.target.value)
                  }
                  placeholder="Ex: Aliment granules 3mm"
                  className="mt-1"
                  required
                />
              </div>

              {/* Quantite + Unite */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Quantite <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={l.quantite}
                    onChange={(e) =>
                      updateLigne(l.id, "quantite", e.target.value)
                    }
                    placeholder="0"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unite</label>
                  <Input
                    value={l.unite}
                    onChange={(e) =>
                      updateLigne(l.id, "unite", e.target.value)
                    }
                    placeholder="kg, litre, sachet..."
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Prix estime */}
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
                  onChange={(e) =>
                    updateLigne(l.id, "prixEstime", e.target.value)
                  }
                  placeholder="0"
                  className="mt-1"
                  required
                />
              </div>

              {/* Sous-total ligne */}
              {l.quantite && l.prixEstime && (
                <p className="text-xs text-muted-foreground text-right">
                  Sous-total :{" "}
                  <span className="font-medium text-foreground">
                    {formatMontant(
                      (parseFloat(l.quantite) || 0) *
                        (parseFloat(l.prixEstime) || 0)
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
        className="w-full mb-4"
        onClick={addLigne}
      >
        <Plus className="h-4 w-4 mr-1" />
        Ajouter une ligne
      </Button>

      {/* Total estime */}
      <Card className="mb-6">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Montant total estime</span>
          <span className="text-lg font-bold">
            {formatMontant(montantEstime)} FCFA
          </span>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-sm text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        className="w-full h-12 text-base"
      >
        Soumettre la liste
      </Button>
    </form>
  );
}
