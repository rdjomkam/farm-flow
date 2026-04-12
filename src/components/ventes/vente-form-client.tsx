"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { ArrowLeft, ShoppingCart, Fish } from "lucide-react";
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
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ClientOption {
  id: string;
  nom: string;
}

interface VagueOption {
  id: string;
  code: string;
  poissonsDisponibles: number;
}

interface PrefillData {
  lotAlevinsId: string;
  lotCode?: string;
  quantite?: number;
  poidsTotalKg?: number;
  clientId?: string;
}

interface Props {
  clients: ClientOption[];
  vagues: VagueOption[];
  prefill?: PrefillData;
}

export function VenteFormClient({ clients, vagues, prefill }: Props) {
  const t = useTranslations("ventes");
  const tSections = useTranslations("errors.sections");
  const router = useRouter();
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [vagueId, setVagueId] = useState("");
  const [quantitePoissons, setQuantitePoissons] = useState(
    prefill?.quantite !== undefined ? String(prefill.quantite) : ""
  );
  const [poidsTotalKg, setPoidsTotalKg] = useState(
    prefill?.poidsTotalKg !== undefined ? String(prefill.poidsTotalKg) : ""
  );
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
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      router.push("/ventes");
    }
  }

  const isValid =
    clientId &&
    vagueId &&
    parseInt(quantitePoissons) > 0 &&
    parseFloat(poidsTotalKg) > 0 &&
    parseFloat(prixUnitaireKg) > 0;

  return (
    <ErrorBoundary section={tSections("saleForm")}>
    <div className="flex flex-col gap-4">
      <Link
        href="/ventes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("ventes.form.back")}
      </Link>

      {/* Banner: pre-filled from lot alevins */}
      {prefill?.lotAlevinsId && (
        <div className="flex items-start gap-3 rounded-lg border border-accent-green-muted bg-accent-green-muted/30 p-3">
          <Fish className="h-5 w-5 text-accent-green mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium text-accent-green">
              Vente pre-remplie depuis le lot{prefill.lotCode ? ` ${prefill.lotCode}` : ""}
            </span>
            <Link
              href={`/reproduction/lots/${prefill.lotAlevinsId}`}
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Voir le lot d&apos;alevins
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Step 1: Client + Vague */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.form.clientEtVague")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger label={t("ventes.form.client")} required aria-required="true">
                <SelectValue placeholder={t("ventes.form.clientPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={vagueId} onValueChange={setVagueId}>
              <SelectTrigger label={t("ventes.form.vague")} required aria-required="true">
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
              required
              value={quantitePoissons}
              onChange={(e) => setQuantitePoissons(e.target.value)}
            />
            <Input
              label={t("ventes.form.poidsTotalKg")}
              type="number"
              min="0.1"
              step="0.1"
              placeholder={t("ventes.form.poidsTotalKgPlaceholder")}
              required
              value={poidsTotalKg}
              onChange={(e) => setPoidsTotalKg(e.target.value)}
            />
            <Input
              label={t("ventes.form.prixUnitaireKg")}
              type="number"
              min="1"
              placeholder={t("ventes.form.prixUnitaireKgPlaceholder")}
              required
              value={prixUnitaireKg}
              onChange={(e) => setPrixUnitaireKg(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Total preview */}
        {montantTotal > 0 && (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-2xl font-bold">
              {formatNumber(montantTotal)} FCFA
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
    </ErrorBoundary>
  );
}
