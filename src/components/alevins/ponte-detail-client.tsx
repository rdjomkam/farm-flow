"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Baby } from "lucide-react";
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
import { useAlevinsService } from "@/services";
import { useApi } from "@/hooks/use-api";
import { StatutPonte, StatutLotAlevins, Permission } from "@/types";
import { useTranslations } from "next-intl";

function statutPonteBadgeClass(statut: string): string {
  if (statut === StatutPonte.EN_COURS) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutPonte.TERMINEE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

function statutLotBadgeClass(statut: string): string {
  if (statut === StatutLotAlevins.EN_INCUBATION)
    return "bg-accent-yellow-muted text-accent-yellow";
  if (statut === StatutLotAlevins.EN_ELEVAGE)
    return "bg-accent-green-muted text-accent-green";
  if (statut === StatutLotAlevins.TRANSFERE)
    return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

interface LotData {
  id: string;
  code: string;
  nombreInitial: number;
  nombreActuel: number;
  statut: string;
  bac: { id: string; nom: string } | null;
}

interface PonteData {
  id: string;
  code: string;
  datePonte: string;
  nombreOeufs: number | null;
  tauxFecondation: number | null;
  statut: string;
  notes: string | null;
  femelle: { id: string; code: string };
  male: { id: string; code: string } | null;
  lots: LotData[];
  _count: { lots: number };
}

interface Props {
  ponte: PonteData;
  femelles: { id: string; code: string }[];
  males: { id: string; code: string }[];
  permissions: Permission[];
}

export function PonteDetailClient({ ponte, femelles, males, permissions }: Props) {
  const t = useTranslations("alevins");
  const router = useRouter();
  const alevinsService = useAlevinsService();
  const { call } = useApi();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Edit form state
  const [code, setCode] = useState(ponte.code);
  const [maleId, setMaleId] = useState(ponte.male?.id ?? "");
  const [datePonte, setDatePonte] = useState(
    ponte.datePonte.split("T")[0]
  );
  const [nombreOeufs, setNombreOeufs] = useState(
    ponte.nombreOeufs !== null ? String(ponte.nombreOeufs) : ""
  );
  const [tauxFecondation, setTauxFecondation] = useState(
    ponte.tauxFecondation !== null ? String(ponte.tauxFecondation) : ""
  );
  const [statut, setStatut] = useState(ponte.statut);
  const [notes, setNotes] = useState(ponte.notes ?? "");

  const statutPonteLabels: Record<StatutPonte, string> = {
    [StatutPonte.EN_COURS]: t("pontes.statuts.EN_COURS"),
    [StatutPonte.TERMINEE]: t("pontes.statuts.TERMINEE"),
    [StatutPonte.ECHOUEE]: t("pontes.statuts.ECHOUEE"),
  };

  const statutLotLabels: Record<StatutLotAlevins, string> = {
    [StatutLotAlevins.EN_INCUBATION]: t("lots.statuts.EN_INCUBATION"),
    [StatutLotAlevins.EN_ELEVAGE]: t("lots.statuts.EN_ELEVAGE"),
    [StatutLotAlevins.TRANSFERE]: t("lots.statuts.TRANSFERE"),
    [StatutLotAlevins.PERDU]: t("lots.statuts.PERDU"),
  };

  async function handleSave() {
    if (!code.trim() || !datePonte) return;
    const result = await alevinsService.updatePonte(ponte.id, {
      code: code.trim(),
      maleId: maleId || null,
      datePonte,
      ...(nombreOeufs && { nombreOeufs: parseInt(nombreOeufs, 10) }),
      ...(tauxFecondation && {
        tauxFecondation: parseFloat(tauxFecondation),
      }),
      statut: statut as StatutPonte,
      notes: notes.trim() || undefined,
    });
    if (result.ok) {
      setEditOpen(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    const result = await call<{ message: string }>(
      `/api/pontes/${ponte.id}`,
      { method: "DELETE" },
      { successMessage: t("pontes.detail.deleteSuccess") }
    );
    if (result.ok) {
      router.push("/alevins/pontes");
    } else {
      setDeleteOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins/pontes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("pontes.title")}
      </Link>

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statutPonteBadgeClass(ponte.statut)}`}
        >
          {statutPonteLabels[ponte.statut as StatutPonte] ?? ponte.statut}
        </span>
        <div className="flex items-center gap-2">
          {permissions.includes(Permission.ALEVINS_MODIFIER) && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-1" />
                {t("pontes.form.modifier")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("pontes.modifierPonte")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label={t("pontes.form.code")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
                <Select value={maleId} onValueChange={setMaleId}>
                  <SelectTrigger label={t("pontes.form.male")}>
                    <SelectValue placeholder={t("pontes.form.malePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {males.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  label={t("pontes.form.datePonte")}
                  type="date"
                  value={datePonte}
                  onChange={(e) => setDatePonte(e.target.value)}
                />
                <Input
                  label={t("pontes.form.nombreOeufs")}
                  type="number"
                  value={nombreOeufs}
                  onChange={(e) => setNombreOeufs(e.target.value)}
                />
                <Input
                  label={t("pontes.form.tauxFecondation")}
                  type="number"
                  min="0"
                  max="100"
                  value={tauxFecondation}
                  onChange={(e) => setTauxFecondation(e.target.value)}
                />
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger label={t("pontes.form.statut")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statutPonteLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  label={t("pontes.form.notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("pontes.form.annuler")}</Button>
                </DialogClose>
                <Button
                  onClick={handleSave}
                  disabled={!code.trim() || !datePonte}
                >
                  {t("pontes.form.enregistrer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}

          {permissions.includes(Permission.ALEVINS_MODIFIER) && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("pontes.supprimerPonte")}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                {t("pontes.detail.confirmDelete", { code: ponte.code })}
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("pontes.form.annuler")}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                >
                  {t("pontes.form.supprimer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Infos principales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("pontes.detail.informations")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pontes.detail.code")}</span>
            <span className="font-medium">{ponte.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pontes.detail.date")}</span>
            <span>
              {new Date(ponte.datePonte).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pontes.detail.femelle")}</span>
            <Link
              href={`/alevins/reproducteurs/${ponte.femelle.id}`}
              className="text-primary hover:underline"
            >
              {ponte.femelle.code}
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pontes.detail.male")}</span>
            {ponte.male ? (
              <Link
                href={`/alevins/reproducteurs/${ponte.male.id}`}
                className="text-primary hover:underline"
              >
                {ponte.male.code}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          {ponte.nombreOeufs !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("pontes.detail.oeufs")}</span>
              <span>{ponte.nombreOeufs.toLocaleString("fr-FR")}</span>
            </div>
          )}
          {ponte.tauxFecondation !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("pontes.detail.tauxFecondation")}</span>
              <span>{ponte.tauxFecondation}%</span>
            </div>
          )}
          {ponte.notes && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">{t("pontes.detail.notes")}</span>
              <p className="text-sm">{ponte.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lots d'alevins */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("pontes.detail.lotsAlevins")} ({ponte.lots.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ponte.lots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Baby className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("lots.aucun")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {ponte.lots.map((l) => (
                <Link key={l.id} href={`/alevins/lots/${l.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{l.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.nombreActuel}/{l.nombreInitial} {t("lots.card.alevins")}
                        {l.bac && ` — ${t("lots.card.bac")} : ${l.bac.nom}`}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutLotBadgeClass(l.statut)}`}
                    >
                      {statutLotLabels[l.statut as StatutLotAlevins] ??
                        l.statut}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
