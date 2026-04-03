"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { CategorieDepense } from "@/types";
import { useDepenseService } from "@/services";

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
  const depenseService = useDepenseService();
  const t = useTranslations("depenses");

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
        message: t("validation.descriptionRequired"),
      });
    }
    if (!categorie) {
      clientErrors.push({
        field: "categorieDepense",
        message: t("validation.categoryRequired"),
      });
    }
    const montantNum = parseFloat(montantTotal);
    if (isNaN(montantNum) || montantNum <= 0) {
      clientErrors.push({
        field: "montantTotal",
        message: t("validation.amountPositive"),
      });
    }
    if (!date) {
      clientErrors.push({ field: "date", message: t("validation.dateRequired") });
    }

    if (clientErrors.length > 0) {
      setSubmitErrors(clientErrors);
      return;
    }
    setSubmitErrors([]);

    const result = await depenseService.createDepense({
      description: description.trim(),
      categorieDepense: categorie as import("@/types").CategorieDepense,
      montantTotal: montantNum,
      date: new Date(date).toISOString(),
      dateEcheance: dateEcheance
        ? new Date(dateEcheance).toISOString()
        : undefined,
      vagueId: vagueId || undefined,
      commandeId: commandeId || undefined,
      notes: notes.trim() || undefined,
    });

    if (result.ok && result.data) {
      router.push(`/depenses/${result.data.id}`);
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("form.mainInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Description */}
            <Input
              id="description"
              label="Description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
              error={getFieldError("description")}
            />

            {/* Categorie */}
            <Select
              value={categorie}
              onValueChange={(v) => setCategorie(v as CategorieDepense)}
            >
              <SelectTrigger
                id="categorie"
                label="Categorie"
                required
                error={getFieldError("categorieDepense")}
              >
                <SelectValue placeholder={t("form.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CategorieDepense).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`categories.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Montant */}
            <Input
              id="montant"
              label="Montant total (FCFA)"
              type="number"
              min={1}
              step="0.01"
              required
              value={montantTotal}
              onChange={(e) => setMontantTotal(e.target.value)}
              placeholder={t("form.amountPlaceholder")}
              error={getFieldError("montantTotal")}
            />

            {/* Date */}
            <Input
              id="date"
              label="Date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={getFieldError("date")}
            />

            {/* Date echeance */}
            <Input
              id="dateEcheance"
              label={t("form.dueDateLabel")}
              type="date"
              value={dateEcheance}
              onChange={(e) => setDateEcheance(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Liens optionnels */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {t("form.optionalLinks")}{" "}
              <span className="text-muted-foreground font-normal text-xs">
                {t("form.optional")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Vague */}
            {vagues.length > 0 && (
              <Select value={vagueId || "__aucune"} onValueChange={(v) => setVagueId(v === "__aucune" ? "" : v)}>
                <SelectTrigger id="vague" label="Vague associee">
                  <SelectValue placeholder={t("form.noWave")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__aucune">{t("form.noWave")}</SelectItem>
                  {vagues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Commande */}
            {commandesLivrees.length > 0 && (
              <Select
                value={commandeId || "__aucune"}
                onValueChange={handleCommandeChange}
              >
                <SelectTrigger id="commande" label="Commande liee">
                  <SelectValue placeholder={t("form.noOrder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__aucune">{t("form.noOrder")}</SelectItem>
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
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("form.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("form.notesPlaceholder")}
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
            <div role="alert" aria-live="assertive" className="text-sm text-destructive bg-destructive/10 rounded p-3">
              {submitErrors[0].message}
            </div>
          )}

        {/* Submit */}
        <Button type="submit" className="w-full h-12 text-base">
          {t("form.createExpense")}
        </Button>
      </form>
    </div>
  );
}
