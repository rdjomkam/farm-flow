"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  User,
  Egg,
  AlertTriangle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useApi } from "@/hooks/use-api";
import {
  SexeReproducteur,
  StatutReproducteur,
  ModeGestionGeniteur,
  SourcingGeniteur,
  GenerationGeniteur,
  StatutPonte,
  Permission,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PonteSummary {
  id: string;
  code: string;
  datePonte: string;
  statut: string;
  _count: { lots: number };
}

interface BacInfo {
  id: string;
  nom: string;
  volume: number;
}

/** Shared structure for both GROUPE (LotGeniteurs) and INDIVIDUEL (Reproducteur) */
interface GeniteurData {
  id: string;
  code: string;
  // GROUPE only
  nom?: string;
  nombrePoissons?: number;
  poidsMoyenG?: number | null;
  poidsMinG?: number | null;
  poidsMaxG?: number | null;
  nombreMalesDisponibles?: number | null;
  seuilAlerteMales?: number | null;
  dateRenouvellementGenetique?: string | null;
  // INDIVIDUEL only
  poids?: number;
  age?: number | null;
  modeGestion?: string;
  pitTag?: string | null;
  photo?: string | null;
  nombrePontesTotal?: number;
  dernierePonte?: string | null;
  tempsReposJours?: number | null;
  pontesAsFemelle?: PonteSummary[];
  pontesAsMale?: PonteSummary[];
  // Shared
  sexe: string;
  statut: string;
  sourcing: string;
  generation: string;
  origine: string | null;
  notes: string | null;
  dateAcquisition: string;
  bacId: string | null;
  bac?: BacInfo | null;
  _count?: { pontesAsFemelle: number; pontesAsMale: number };
}

interface Props {
  geniteur: GeniteurData;
  mode: "GROUPE" | "INDIVIDUEL";
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function statutBadgeClass(statut: string): string {
  if (statut === StatutReproducteur.ACTIF) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutReproducteur.EN_REPOS) return "bg-accent-blue-muted text-accent-blue";
  if (statut === StatutReproducteur.REFORME) return "bg-muted text-muted-foreground";
  return "bg-accent-red-muted text-accent-red";
}

function ponteBadgeClass(statut: string): string {
  if (statut === StatutPonte.EN_COURS) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutPonte.TERMINEE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GeniteurDetailClient({ geniteur, mode, permissions }: Props) {
  const t = useTranslations("reproduction.geniteurs");
  const tPonteStatuts = useTranslations("reproduction.ponteStatuts");
  const locale = useLocale();
  const router = useRouter();
  const { call } = useApi();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reformerOpen, setReformerOpen] = useState(false);
  const [utiliserMaleOpen, setUtiliserMaleOpen] = useState(false);

  // Edit form state — shared fields
  const [statut, setStatut] = useState(geniteur.statut);
  const [notes, setNotes] = useState(geniteur.notes ?? "");
  const [origine, setOrigine] = useState(geniteur.origine ?? "");
  // GROUPE extra
  const [nom, setNom] = useState(geniteur.nom ?? "");
  const [nombrePoissons, setNombrePoissons] = useState(
    geniteur.nombrePoissons != null ? String(geniteur.nombrePoissons) : ""
  );
  const [poidsMoyenG, setPoidsMoyenG] = useState(
    geniteur.poidsMoyenG != null ? String(geniteur.poidsMoyenG) : ""
  );
  const [nombreMalesDisp, setNombreMalesDisp] = useState(
    geniteur.nombreMalesDisponibles != null
      ? String(geniteur.nombreMalesDisponibles)
      : ""
  );
  // INDIVIDUEL extra
  const [code, setCode] = useState(geniteur.code);
  const [poids, setPoids] = useState(geniteur.poids != null ? String(geniteur.poids) : "");
  const [age, setAge] = useState(geniteur.age != null ? String(geniteur.age) : "");

  // Utiliser male state — tracks live count after API call
  const [nombreUtilises, setNombreUtilises] = useState("1");
  const [malesDisponibles, setMalesDisponibles] = useState<number | null>(
    geniteur.nombreMalesDisponibles ?? null
  );

  // Labels
  const sexeLabel: Record<SexeReproducteur, string> = {
    [SexeReproducteur.MALE]: t("sexe.MALE"),
    [SexeReproducteur.FEMELLE]: t("sexe.FEMELLE"),
  };

  const statutLabels: Record<StatutReproducteur, string> = {
    [StatutReproducteur.ACTIF]: t("statuts.ACTIF"),
    [StatutReproducteur.EN_REPOS]: t("statuts.EN_REPOS"),
    [StatutReproducteur.REFORME]: t("statuts.REFORME"),
    [StatutReproducteur.SACRIFIE]: t("statuts.SACRIFIE"),
    [StatutReproducteur.MORT]: t("statuts.MORT"),
  };

  const sourcingLabels: Record<SourcingGeniteur, string> = {
    [SourcingGeniteur.PROPRE_PRODUCTION]: t("sourcing.PROPRE_PRODUCTION"),
    [SourcingGeniteur.ACHAT_FERMIER]: t("sourcing.ACHAT_FERMIER"),
    [SourcingGeniteur.SAUVAGE]: t("sourcing.SAUVAGE"),
    [SourcingGeniteur.STATION_RECHERCHE]: t("sourcing.STATION_RECHERCHE"),
  };

  const generationLabels: Record<GenerationGeniteur, string> = {
    [GenerationGeniteur.G0_SAUVAGE]: t("generation.G0_SAUVAGE"),
    [GenerationGeniteur.G1]: t("generation.G1"),
    [GenerationGeniteur.G2]: t("generation.G2"),
    [GenerationGeniteur.G3_PLUS]: t("generation.G3_PLUS"),
    [GenerationGeniteur.INCONNUE]: t("generation.INCONNUE"),
  };

  const modeParam = mode === "INDIVIDUEL" ? "?mode=INDIVIDUEL" : "?mode=GROUPE";

  // Combine pontes for INDIVIDUEL
  const pontes =
    mode === "INDIVIDUEL"
      ? [
          ...(geniteur.pontesAsFemelle ?? []),
          ...(geniteur.pontesAsMale ?? []),
        ].sort(
          (a, b) =>
            new Date(b.datePonte).getTime() - new Date(a.datePonte).getTime()
        )
      : [];

  const totalPontes =
    (geniteur._count?.pontesAsFemelle ?? 0) +
    (geniteur._count?.pontesAsMale ?? 0);

  const isMaleGroup =
    mode === "GROUPE" && geniteur.sexe === SexeReproducteur.MALE;

  const isLowStock =
    isMaleGroup &&
    malesDisponibles !== null &&
    geniteur.seuilAlerteMales !== null &&
    malesDisponibles <= (geniteur.seuilAlerteMales ?? 0);

  const displayName =
    mode === "GROUPE" ? (geniteur.nom ?? geniteur.code) : geniteur.code;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function handleSave() {
    if (mode === "GROUPE") {
      if (!nom.trim()) return;
      await call(
        `/api/reproduction/geniteurs/${geniteur.id}?mode=GROUPE`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "GROUPE",
            nom: nom.trim(),
            ...(nombrePoissons && {
              nombrePoissons: parseInt(nombrePoissons, 10),
            }),
            ...(poidsMoyenG && { poidsMoyenG: parseFloat(poidsMoyenG) }),
            ...(geniteur.sexe === SexeReproducteur.MALE &&
              nombreMalesDisp && {
                nombreMalesDisponibles: parseInt(nombreMalesDisp, 10),
              }),
            origine: origine.trim() || null,
            statut: statut as StatutReproducteur,
            notes: notes.trim() || null,
          }),
        },
        { successMessage: t("detail.reformerSuccess") }
      );
    } else {
      if (!code.trim() || !poids) return;
      await call(
        `/api/reproduction/geniteurs/${geniteur.id}?mode=INDIVIDUEL`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "INDIVIDUEL",
            code: code.trim(),
            poids: parseFloat(poids),
            ...(age.trim() && { age: parseInt(age, 10) }),
            origine: origine.trim() || undefined,
            statut: statut as StatutReproducteur,
            notes: notes.trim() || undefined,
          }),
        },
        { successMessage: t("detail.reformerSuccess") }
      );
    }
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const result = await call(
      `/api/reproduction/geniteurs/${geniteur.id}${modeParam}`,
      { method: "DELETE" },
      { successMessage: t("detail.deleteSuccess") }
    );
    if (result.ok) {
      router.push("/reproduction/geniteurs");
    } else {
      setDeleteOpen(false);
    }
  }

  async function handleReformer() {
    const result = await call(
      `/api/reproduction/geniteurs/${geniteur.id}${modeParam}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          statut: StatutReproducteur.REFORME,
        }),
      },
      { successMessage: t("detail.reformerSuccess") }
    );
    if (result.ok) {
      setReformerOpen(false);
      router.refresh();
    } else {
      setReformerOpen(false);
    }
  }

  async function handleUtiliserMale() {
    const n = parseInt(nombreUtilises, 10);
    if (!n || n <= 0) return;
    const result = await call<{ nombreMalesDisponibles: number }>(
      `/api/reproduction/geniteurs/${geniteur.id}/utiliser-male`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreUtilises: n }),
      },
      { successMessage: t("utiliserMale.success") }
    );
    if (result.ok && result.data) {
      setMalesDisponibles(result.data.nombreMalesDisponibles);
      setUtiliserMaleOpen(false);
      setNombreUtilises("1");
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href="/reproduction/geniteurs"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToGeniteurs")}
      </Link>

      {/* Header: badges + action buttons */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode badge */}
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground">
            {mode === "GROUPE" ? (
              <Users className="h-3 w-3" />
            ) : (
              <User className="h-3 w-3" />
            )}
            {t(`mode.${mode}`)}
          </span>
          {/* Sexe badge */}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
              geniteur.sexe === SexeReproducteur.FEMELLE
                ? "bg-accent-purple-muted text-accent-purple"
                : "bg-accent-blue-muted text-accent-blue"
            }`}
          >
            {sexeLabel[geniteur.sexe as SexeReproducteur] ?? geniteur.sexe}
          </span>
          {/* Statut badge */}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statutBadgeClass(geniteur.statut)}`}
          >
            {statutLabels[geniteur.statut as StatutReproducteur] ??
              geniteur.statut}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {permissions.includes(Permission.ALEVINS_MODIFIER) && (
            <>
              {/* Edit */}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Pencil className="h-4 w-4 mr-1" />
                    {t("form.modifier")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("modifierGeniteur")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    {mode === "GROUPE" && (
                      <>
                        <Input
                          label={t("form.nom")}
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          autoFocus
                        />
                        <Input
                          label={t("form.nombrePoissons")}
                          type="number"
                          value={nombrePoissons}
                          onChange={(e) => setNombrePoissons(e.target.value)}
                        />
                        <Input
                          label={t("form.poidsMoyenG")}
                          type="number"
                          value={poidsMoyenG}
                          onChange={(e) => setPoidsMoyenG(e.target.value)}
                        />
                        {geniteur.sexe === SexeReproducteur.MALE && (
                          <Input
                            label={t("form.nombreMalesDisponibles")}
                            type="number"
                            value={nombreMalesDisp}
                            onChange={(e) =>
                              setNombreMalesDisp(e.target.value)
                            }
                          />
                        )}
                      </>
                    )}
                    {mode === "INDIVIDUEL" && (
                      <>
                        <Input
                          label={t("form.code")}
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          autoFocus
                        />
                        <Input
                          label={t("form.poids")}
                          type="number"
                          value={poids}
                          onChange={(e) => setPoids(e.target.value)}
                        />
                        <Input
                          label={t("form.age")}
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                        />
                      </>
                    )}
                    <Input
                      label={t("form.origine")}
                      value={origine}
                      onChange={(e) => setOrigine(e.target.value)}
                    />
                    <Select value={statut} onValueChange={setStatut}>
                      <SelectTrigger label={t("detail.statut")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statutLabels).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      label={t("form.notes")}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{t("form.annuler")}</Button>
                    </DialogClose>
                    <Button
                      onClick={handleSave}
                      disabled={
                        mode === "GROUPE"
                          ? !nom.trim()
                          : !code.trim() || !poids
                      }
                    >
                      {t("form.enregistrer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Réformer — only visible when not already reformed */}
              {geniteur.statut !== StatutReproducteur.REFORME && (
                <Dialog open={reformerOpen} onOpenChange={setReformerOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      {t("form.reformer")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("reformerGeniteur")}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-2">
                      {t("detail.confirmReformer", { code: displayName })}
                    </p>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">{t("form.annuler")}</Button>
                      </DialogClose>
                      <Button onClick={handleReformer}>
                        {t("form.reformer")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}

          {/* Delete */}
          {permissions.includes(Permission.ALEVINS_SUPPRIMER) && (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("supprimerGeniteur")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground py-2">
                  {t("detail.confirmDelete", { code: displayName })}
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("form.annuler")}</Button>
                  </DialogClose>
                  <Button variant="danger" onClick={handleDelete}>
                    {t("form.supprimer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t("stats.totalPontes")}</p>
          <p className="text-2xl font-bold mt-1">{totalPontes}</p>
        </div>

        {/* Males disponibles — GROUPE MALE only */}
        {isMaleGroup && malesDisponibles !== null && (
          <div
            className={`rounded-xl border p-3 ${
              isLowStock
                ? "border-accent-red/50 bg-accent-red-muted"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("stats.malesDisponibles")}
              </p>
              {isLowStock && (
                <AlertTriangle className="h-3.5 w-3.5 text-accent-red" />
              )}
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${isLowStock ? "text-accent-red" : ""}`}
            >
              {malesDisponibles}
            </p>
          </div>
        )}

        {/* Last ponte — INDIVIDUEL */}
        {mode === "INDIVIDUEL" && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {t("stats.dernierePonte")}
            </p>
            <p className="text-sm font-semibold mt-1">
              {geniteur.dernierePonte
                ? new Date(geniteur.dernierePonte).toLocaleDateString(locale)
                : t("stats.aucuneDate")}
            </p>
          </div>
        )}
      </div>

      {/* Utiliser Males CTA — GROUPE MALE with nombreMalesDisponibles initialized */}
      {isMaleGroup &&
        malesDisponibles !== null &&
        permissions.includes(Permission.ALEVINS_MODIFIER) && (
          <div
            className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
              isLowStock
                ? "border-accent-red/50 bg-accent-red-muted"
                : "border-primary/20 bg-primary/5"
            }`}
          >
            <div>
              <p className="text-sm font-semibold">
                {t("stats.malesDisponibles")}
              </p>
              <p className="text-3xl font-bold mt-0.5">{malesDisponibles}</p>
              {geniteur.seuilAlerteMales != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Seuil : {geniteur.seuilAlerteMales}
                </p>
              )}
            </div>
            <Dialog open={utiliserMaleOpen} onOpenChange={setUtiliserMaleOpen}>
              <DialogTrigger asChild>
                <Button size="md">{t("utiliserMale.button")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("utiliserMale.title")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground py-1">
                  {t("utiliserMale.description")}
                </p>
                <div className="py-2">
                  <Input
                    label={t("utiliserMale.nombreUtilises")}
                    type="number"
                    min={1}
                    max={malesDisponibles}
                    value={nombreUtilises}
                    onChange={(e) => setNombreUtilises(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("utiliserMale.malesRestants", {
                      count: Math.max(
                        0,
                        malesDisponibles -
                          (parseInt(nombreUtilises, 10) || 0)
                      ),
                    })}
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">
                      {t("utiliserMale.annuler")}
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleUtiliserMale}
                    disabled={
                      !nombreUtilises ||
                      parseInt(nombreUtilises, 10) <= 0 ||
                      parseInt(nombreUtilises, 10) > (malesDisponibles ?? 0)
                    }
                  >
                    {t("utiliserMale.confirmer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

      {/* Informations card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("detail.informations")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {/* GROUPE specific */}
          {mode === "GROUPE" && (
            <>
              {geniteur.nom && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("detail.nom")}</span>
                  <span className="font-medium">{geniteur.nom}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("detail.code")}</span>
                <span className="font-mono text-xs">{geniteur.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("detail.sexe")}</span>
                <span>
                  {sexeLabel[geniteur.sexe as SexeReproducteur] ??
                    geniteur.sexe}
                </span>
              </div>
              {geniteur.nombrePoissons != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.nombrePoissons")}
                  </span>
                  <span>
                    {geniteur.nombrePoissons} {t("detail.poissonsUnit")}
                  </span>
                </div>
              )}
              {geniteur.poidsMoyenG != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.poidsMoyen")}
                  </span>
                  <span>
                    {geniteur.poidsMoyenG} {t("detail.grammesUnit")}
                  </span>
                </div>
              )}
              {geniteur.poidsMinG != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.poidsMin")}
                  </span>
                  <span>
                    {geniteur.poidsMinG} {t("detail.grammesUnit")}
                  </span>
                </div>
              )}
              {geniteur.poidsMaxG != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.poidsMax")}
                  </span>
                  <span>
                    {geniteur.poidsMaxG} {t("detail.grammesUnit")}
                  </span>
                </div>
              )}
              {geniteur.seuilAlerteMales != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.seuilAlerteMales")}
                  </span>
                  <span>{geniteur.seuilAlerteMales}</span>
                </div>
              )}
              {geniteur.dateRenouvellementGenetique && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.renouvellementGenetique")}
                  </span>
                  <span>
                    {new Date(
                      geniteur.dateRenouvellementGenetique
                    ).toLocaleDateString(locale)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* INDIVIDUEL specific */}
          {mode === "INDIVIDUEL" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("detail.code")}</span>
                <span className="font-mono text-xs">{geniteur.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("detail.sexe")}</span>
                <span>
                  {sexeLabel[geniteur.sexe as SexeReproducteur] ??
                    geniteur.sexe}
                </span>
              </div>
              {geniteur.poids != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.poids")}
                  </span>
                  <span>
                    {geniteur.poids} {t("detail.grammesUnit")}
                  </span>
                </div>
              )}
              {geniteur.age != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("detail.age")}</span>
                  <span>
                    {geniteur.age} {t("detail.moisUnit")}
                  </span>
                </div>
              )}
              {geniteur.modeGestion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.modeGestion")}
                  </span>
                  <span>
                    {geniteur.modeGestion === ModeGestionGeniteur.INDIVIDUEL
                      ? t("mode.INDIVIDUEL")
                      : t("mode.GROUPE")}
                  </span>
                </div>
              )}
              {geniteur.pitTag && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.pitTag")}
                  </span>
                  <span className="font-mono text-xs">{geniteur.pitTag}</span>
                </div>
              )}
              {geniteur.tempsReposJours != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.tempsReposJours")}
                  </span>
                  <span>
                    {geniteur.tempsReposJours} {t("detail.joursUnit")}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Shared fields */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("detail.sourcing")}</span>
            <span>
              {sourcingLabels[geniteur.sourcing as SourcingGeniteur] ??
                geniteur.sourcing}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("detail.generation")}
            </span>
            <span>
              {generationLabels[geniteur.generation as GenerationGeniteur] ??
                geniteur.generation}
            </span>
          </div>
          {geniteur.origine && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("detail.origine")}
              </span>
              <span>{geniteur.origine}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("detail.bac")}</span>
            <span>
              {geniteur.bac ? geniteur.bac.nom : t("detail.bacNonAssigne")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("detail.acquisition")}
            </span>
            <span>
              {new Date(geniteur.dateAcquisition).toLocaleDateString(locale)}
            </span>
          </div>
          {geniteur.notes && (
            <div className="flex flex-col gap-1 pt-2 border-t border-border">
              <span className="text-muted-foreground">{t("detail.notes")}</span>
              <p className="text-sm">{geniteur.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des pontes — INDIVIDUEL */}
      {mode === "INDIVIDUEL" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("detail.historiquePointes")} ({pontes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pontes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Egg className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("aucunePonte")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pontes.map((p) => (
                  <Link
                    key={p.id}
                    href={`/reproduction/pontes/${p.id}`}
                  >
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{p.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.datePonte).toLocaleDateString(locale)}{" "}
                          — {p._count.lots} lot(s)
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ponteBadgeClass(p.statut)}`}
                      >
                        {p.statut === StatutPonte.EN_COURS
                          ? tPonteStatuts("EN_COURS")
                          : p.statut === StatutPonte.TERMINEE
                            ? tPonteStatuts("TERMINEE")
                            : tPonteStatuts("ECHOUEE")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pontes summary — GROUPE */}
      {mode === "GROUPE" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("detail.historiquePointes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalPontes === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Egg className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("aucunePonte")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Egg className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {totalPontes > 1
                      ? t("detail.pontesEnregistreesPlural", { count: totalPontes })
                      : t("detail.pontesEnregistreesSingular", { count: totalPontes })}
                  </span>
                </div>
                <Link
                  href="/reproduction/pontes"
                  className="text-sm text-primary hover:underline w-fit"
                >
                  {t("detail.voirToutesPontes")}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
