"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CategorieDepense } from "@/types";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const categorieLabels: Record<CategorieDepense, string> = {
  [CategorieDepense.ALIMENT]: "Aliment",
  [CategorieDepense.INTRANT]: "Intrant",
  [CategorieDepense.EQUIPEMENT]: "Equipement",
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
// Types
// ---------------------------------------------------------------------------

interface VagueOption {
  id: string;
  code: string;
}

interface CommandeOption {
  id: string;
  numero: string;
  montantTotal: number;
}

interface Props {
  vagues: VagueOption[];
  commandesLivrees: CommandeOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepenseFormClient({ vagues, commandesLivrees }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form fields
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<CategorieDepense | "">("");
  const [montantTotal, setMontantTotal] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0] // today YYYY-MM-DD
  );
  const [dateEcheance, setDateEcheance] = useState("");
  const [vagueId, setVagueId] = useState<string>("");
  const [commandeId, setCommandeId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const errors: Record<string, string> = {};
  const [submitErrors, setSubmitErrors] = useState<
    { field: string; message: string }[]
  >([]);

  // Lier a une commande auto-remplit la categorie et le montant
  function handleCommandeChange(value: string) {
    setCommandeId(value);
    if (value === "__aucune") {
      setCommandeId("");
      return;
    }
    const commande = commandesLivrees.find((c) => c.id === value);
    if (commande) {
      setMontantTotal(String(commande.montantTotal));
      // Garder la description generee
      if (!description) {
        setDescription(`Commande ${commande.numero}`);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client validation
    const clientErrors: { field: string; message: string }[] = [];
    if (!description.trim()) {
      clientErrors.push({
        field: "description",
        message: "La description est obligatoire.",
      });
    }
    if (!categorie) {
      clientErrors.push({
        field: "categorieDepense",
        message: "La categorie est obligatoire.",
      });
    }
    const montantNum = parseFloat(montantTotal);
    if (isNaN(montantNum) || montantNum <= 0) {
      clientErrors.push({
        field: "montantTotal",
        message: "Le montant doit etre un nombre positif.",
      });
    }
    if (!date) {
      clientErrors.push({ field: "date", message: "La date est obligatoire." });
    }

    if (clientErrors.length > 0) {
      setSubmitErrors(clientErrors);
      return;
    }
    setSubmitErrors([]);

    setLoading(true);
    try {
      const res = await fetch("/api/depenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          categorieDepense: categorie,
          montantTotal: montantNum,
          date: new Date(date).toISOString(),
          dateEcheance: dateEcheance
            ? new Date(dateEcheance).toISOString()
            : undefined,
          vagueId: vagueId || undefined,
          commandeId: commandeId || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors) {
          setSubmitErrors(err.errors);
          return;
        }
        throw new Error(err.message ?? "Erreur");
      }

      const depense = await res.json();
      toast({ title: `Depense ${depense.numero} creee avec succes` });
      router.push(`/depenses/${depense.id}`);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur serveur",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  function getFieldError(field: string) {
    return submitErrors.find((e) => e.field === field)?.message;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Informations principales</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Achat aliment, loyer, salaire..."
                className={getFieldError("description") ? "border-destructive" : ""}
              />
              {getFieldError("description") && (
                <p className="text-xs text-destructive">
                  {getFieldError("description")}
                </p>
              )}
            </div>

            {/* Categorie */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="categorie" className="text-sm font-medium">
                Categorie <span className="text-destructive">*</span>
              </label>
              <Select
                value={categorie}
                onValueChange={(v) => setCategorie(v as CategorieDepense)}
              >
                <SelectTrigger
                  id="categorie"
                  className={
                    getFieldError("categorieDepense") ? "border-destructive" : ""
                  }
                >
                  <SelectValue placeholder="Choisir une categorie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CategorieDepense).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categorieLabels[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getFieldError("categorieDepense") && (
                <p className="text-xs text-destructive">
                  {getFieldError("categorieDepense")}
                </p>
              )}
            </div>

            {/* Montant */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="montant" className="text-sm font-medium">
                Montant total (FCFA) <span className="text-destructive">*</span>
              </label>
              <Input
                id="montant"
                type="number"
                min={1}
                step="0.01"
                value={montantTotal}
                onChange={(e) => setMontantTotal(e.target.value)}
                placeholder="Ex: 50000"
                className={
                  getFieldError("montantTotal") ? "border-destructive" : ""
                }
              />
              {getFieldError("montantTotal") && (
                <p className="text-xs text-destructive">
                  {getFieldError("montantTotal")}
                </p>
              )}
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date" className="text-sm font-medium">
                Date <span className="text-destructive">*</span>
              </label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={getFieldError("date") ? "border-destructive" : ""}
              />
              {getFieldError("date") && (
                <p className="text-xs text-destructive">
                  {getFieldError("date")}
                </p>
              )}
            </div>

            {/* Date echeance */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dateEcheance" className="text-sm font-medium">
                Date d&apos;echeance{" "}
                <span className="text-muted-foreground text-xs">(optionnel)</span>
              </label>
              <Input
                id="dateEcheance"
                type="date"
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Liens optionnels */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Liens optionnels{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (facultatif)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Vague */}
            {vagues.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vague" className="text-sm font-medium">Vague associee</label>
                <Select value={vagueId || "__aucune"} onValueChange={(v) => setVagueId(v === "__aucune" ? "" : v)}>
                  <SelectTrigger id="vague">
                    <SelectValue placeholder="Aucune vague" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__aucune">Aucune vague</SelectItem>
                    {vagues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Commande */}
            {commandesLivrees.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="commande" className="text-sm font-medium">Commande liee</label>
                <Select
                  value={commandeId || "__aucune"}
                  onValueChange={handleCommandeChange}
                >
                  <SelectTrigger id="commande">
                    <SelectValue placeholder="Aucune commande" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__aucune">Aucune commande</SelectItem>
                    {commandesLivrees.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero} —{" "}
                        {new Intl.NumberFormat("fr-FR").format(
                          Math.round(c.montantTotal)
                        )}{" "}
                        FCFA
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complementaires..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Global errors */}
        {submitErrors.length > 0 &&
          !submitErrors.some((e) =>
            [
              "description",
              "categorieDepense",
              "montantTotal",
              "date",
            ].includes(e.field)
          ) && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-3">
              {submitErrors[0].message}
            </div>
          )}

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full h-12 text-base">
          {loading ? "Creation en cours..." : "Creer la depense"}
        </Button>
      </form>
    </div>
  );
}
