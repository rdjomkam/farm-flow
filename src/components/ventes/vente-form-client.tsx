"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ShoppingCart } from "lucide-react";
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
import { useVenteService } from "@/services";

interface ClientOption {
  id: string;
  nom: string;
}

interface VagueOption {
  id: string;
  code: string;
  poissonsDisponibles: number;
}

interface Props {
  clients: ClientOption[];
  vagues: VagueOption[];
}

export function VenteFormClient({ clients, vagues }: Props) {
  const t = useTranslations("ventes");
  const router = useRouter();
  const venteService = useVenteService();

  const [clientId, setClientId] = useState("");
  const [vagueId, setVagueId] = useState("");
  const [quantitePoissons, setQuantitePoissons] = useState("");
  const [poidsTotalKg, setPoidsTotalKg] = useState("");
  const [prixUnitaireKg, setPrixUnitaireKg] = useState("");
  const [notes, setNotes] = useState("");

  const selectedVague = vagues.find((v) => v.id === vagueId);
  const montantTotal =
    (parseFloat(poidsTotalKg) || 0) * (parseFloat(prixUnitaireKg) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !vagueId) return;

    const result = await venteService.createVente({
      clientId,
      vagueId,
      quantitePoissons: parseInt(quantitePoissons),
      poidsTotalKg: parseFloat(poidsTotalKg),
      prixUnitaireKg: parseFloat(prixUnitaireKg),
      ...(notes.trim() && { notes: notes.trim() }),
    });

    if (result.ok) {
      router.push("/ventes");
      router.refresh();
    }
  }

  const isValid =
    clientId &&
    vagueId &&
    parseInt(quantitePoissons) > 0 &&
    parseFloat(poidsTotalKg) > 0 &&
    parseFloat(prixUnitaireKg) > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/ventes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("ventes.form.back")}
      </Link>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Step 1: Client + Vague */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.form.clientEtVague")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger label={t("ventes.form.client")}>
                <SelectValue placeholder={t("ventes.form.clientPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={vagueId} onValueChange={setVagueId}>
              <SelectTrigger label={t("ventes.form.vague")}>
                <SelectValue placeholder={t("ventes.form.vaguePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {t("ventes.form.vagueOption", { code: v.code, count: v.poissonsDisponibles })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVague && (
              <p className="text-xs text-muted-foreground">
                {t("ventes.form.poissonsDisponibles", { count: selectedVague.poissonsDisponibles })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Quantities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.form.quantitesPrix")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              label={t("ventes.form.nombrePoissons")}
              type="number"
              min="1"
              max={selectedVague?.poissonsDisponibles ?? undefined}
              placeholder={t("ventes.form.nombrePoissonsPlaceholder")}
              value={quantitePoissons}
              onChange={(e) => setQuantitePoissons(e.target.value)}
            />
            <Input
              label={t("ventes.form.poidsTotalKg")}
              type="number"
              min="0.1"
              step="0.1"
              placeholder={t("ventes.form.poidsTotalKgPlaceholder")}
              value={poidsTotalKg}
              onChange={(e) => setPoidsTotalKg(e.target.value)}
            />
            <Input
              label={t("ventes.form.prixUnitaireKg")}
              type="number"
              min="1"
              placeholder={t("ventes.form.prixUnitaireKgPlaceholder")}
              value={prixUnitaireKg}
              onChange={(e) => setPrixUnitaireKg(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Total preview */}
        {montantTotal > 0 && (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-2xl font-bold">
              {montantTotal.toLocaleString("fr-FR")} FCFA
            </p>
            <p className="text-xs text-muted-foreground">{t("ventes.form.montantTotal")}</p>
          </div>
        )}

        {/* Notes */}
        <Textarea
          label={t("ventes.form.notes")}
          placeholder={t("ventes.form.notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <Button
          type="submit"
          disabled={!isValid}
          className="w-full min-h-[48px]"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {t("ventes.form.submit")}
        </Button>
      </form>
    </div>
  );
}
