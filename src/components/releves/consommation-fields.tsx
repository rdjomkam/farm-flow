"use client";

import { useState } from "react";
import { Plus, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UniteStock } from "@/types";

const uniteLabels: Record<string, string> = {
  [UniteStock.KG]: "kg",
  [UniteStock.LITRE]: "L",
  [UniteStock.UNITE]: "unite",
  [UniteStock.SACS]: "sacs",
};

export interface ConsommationLine {
  produitId: string;
  quantite: string;
}

export interface ProduitOption {
  id: string;
  nom: string;
  categorie: string;
  unite: string;
  stockActuel: number;
}

interface ConsommationFieldsProps {
  lignes: ConsommationLine[];
  onChange: (lignes: ConsommationLine[]) => void;
  produits: ProduitOption[];
  categorie: string;
  optional?: boolean;
}

export function ConsommationFields({
  lignes,
  onChange,
  produits,
  categorie,
  optional,
}: ConsommationFieldsProps) {
  const [expanded, setExpanded] = useState(!optional || lignes.length > 0);

  const filtered = produits.filter((p) => p.categorie === categorie);

  function addLine() {
    onChange([...lignes, { produitId: "", quantite: "" }]);
    if (!expanded) setExpanded(true);
  }

  function removeLine(index: number) {
    onChange(lignes.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof ConsommationLine, value: string) {
    const updated = [...lignes];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  if (filtered.length === 0) return null;

  const label = categorie === "ALIMENT" ? "Aliments consommes" : "Intrants utilises";

  return (
    <div className="space-y-2">
      {optional ? (
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded && lignes.length === 0) {
              onChange([{ produitId: "", quantite: "" }]);
            }
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")} />
          {label}
          <span className="text-xs">(optionnel)</span>
        </button>
      ) : (
        <p className="text-sm font-medium">{label}</p>
      )}

      {expanded && (
        <div className="space-y-2 pl-1">
          {lignes.map((ligne, i) => {
            const produit = filtered.find((p) => p.id === ligne.produitId);
            const unite = produit ? (uniteLabels[produit.unite] ?? produit.unite) : "";
            const qte = parseFloat(ligne.quantite) || 0;
            const overStock = produit && qte > produit.stockActuel;

            return (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Select
                    value={ligne.produitId}
                    onValueChange={(v) => updateLine(i, "produitId", v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtered.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom} ({p.stockActuel} {uniteLabels[p.unite] ?? p.unite})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder={`Qte${unite ? ` (${unite})` : ""}`}
                    value={ligne.quantite}
                    onChange={(e) => updateLine(i, "quantite", e.target.value)}
                    className="text-sm"
                  />
                  {overStock && (
                    <p className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Stock dispo : {produit.stockActuel} {unite}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-8 w-8 p-0 text-danger"
                  onClick={() => removeLine(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="w-full text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter un produit
          </Button>
        </div>
      )}
    </div>
  );
}
