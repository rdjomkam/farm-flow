"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Egg } from "lucide-react";
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
import { SexeReproducteur, StatutReproducteur, Permission } from "@/types";
import { useTranslations } from "next-intl";

function statutBadgeClass(statut: string): string {
  if (statut === StatutReproducteur.ACTIF) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutReproducteur.REFORME) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

interface PonteData {
  id: string;
  code: string;
  datePonte: string;
  statut: string;
  nombreOeufs: number | null;
  tauxFecondation: number | null;
  _count: { lots: number };
}

interface ReproducteurData {
  id: string;
  code: string;
  sexe: string;
  poids: number;
  age: number | null;
  origine: string | null;
  statut: string;
  dateAcquisition: string;
  notes: string | null;
  pontesAsFemelle: PonteData[];
  pontesAsMale: PonteData[];
  _count: { pontesAsFemelle: number; pontesAsMale: number };
}

interface Props {
  reproducteur: ReproducteurData;
  permissions: Permission[];
}

export function ReproducteurDetailClient({ reproducteur, permissions }: Props) {
  const t = useTranslations("alevins");
  const router = useRouter();
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();
  const { call } = useApi();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Edit form state
  const [code, setCode] = useState(reproducteur.code);
  const [poids, setPoids] = useState(String(reproducteur.poids));
  const [age, setAge] = useState(reproducteur.age != null ? String(reproducteur.age) : "");
  const [origine, setOrigine] = useState(reproducteur.origine ?? "");
  const [statut, setStatut] = useState(reproducteur.statut);
  const [notes, setNotes] = useState(reproducteur.notes ?? "");

  const sexeLabels: Record<SexeReproducteur, string> = {
    [SexeReproducteur.MALE]: t("reproducteurs.sexe.MALE"),
    [SexeReproducteur.FEMELLE]: t("reproducteurs.sexe.FEMELLE"),
  };

  const statutLabels: Record<StatutReproducteur, string> = {
    [StatutReproducteur.ACTIF]: t("reproducteurs.statuts.ACTIF"),
    [StatutReproducteur.REFORME]: t("reproducteurs.statuts.REFORME"),
    [StatutReproducteur.MORT]: t("reproducteurs.statuts.MORT"),
  };

  async function handleSave() {
    if (!code.trim() || !poids) return;
    const result = await alevinsService.updateReproducteur(reproducteur.id, {
      code: code.trim(),
      poids: parseFloat(poids),
      ...(age.trim() && { age: parseInt(age, 10) }),
      origine: origine.trim() || undefined,
      statut: statut as StatutReproducteur,
      notes: notes.trim() || undefined,
    });
    if (result.ok) {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.reproducteurs() });
    }
  }

  async function handleDelete() {
    const result = await call<{ message: string }>(
      `/api/reproducteurs/${reproducteur.id}`,
      { method: "DELETE" },
      { successMessage: t("reproducteurs.detail.deleteSuccess") }
    );
    if (result.ok) {
      router.push("/alevins/reproducteurs");
    } else {
      setDeleteOpen(false);
    }
  }

  const pontes =
    reproducteur.sexe === SexeReproducteur.FEMELLE
      ? reproducteur.pontesAsFemelle
      : reproducteur.pontesAsMale;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins/reproducteurs"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("reproducteurs.title")}
      </Link>

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
              reproducteur.sexe === SexeReproducteur.FEMELLE
                ? "bg-accent-pink-muted text-accent-pink"
                : "bg-accent-indigo-muted text-accent-indigo"
            }`}
          >
            {sexeLabels[reproducteur.sexe as SexeReproducteur] ??
              reproducteur.sexe}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statutBadgeClass(reproducteur.statut)}`}
          >
            {statutLabels[reproducteur.statut as StatutReproducteur] ??
              reproducteur.statut}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {permissions.includes(Permission.ALEVINS_MODIFIER) && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-1" />
                {t("reproducteurs.form.modifier")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("reproducteurs.modifierReproducteur")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label={t("reproducteurs.form.code")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
                <Input
                  label={t("reproducteurs.form.poids")}
                  type="number"
                  value={poids}
                  onChange={(e) => setPoids(e.target.value)}
                />
                <Input
                  label={t("reproducteurs.form.age")}
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
                <Input
                  label={t("reproducteurs.form.origine")}
                  value={origine}
                  onChange={(e) => setOrigine(e.target.value)}
                />
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger label={t("reproducteurs.form.statut")}>
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
                  label={t("reproducteurs.form.notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("reproducteurs.form.annuler")}</Button>
                </DialogClose>
                <Button
                  onClick={handleSave}
                  disabled={!code.trim() || !poids}
                >
                  {t("reproducteurs.form.enregistrer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}

          {permissions.includes(Permission.ALEVINS_SUPPRIMER) && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("reproducteurs.supprimerReproducteur")}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                {t("reproducteurs.detail.confirmDelete", { code: reproducteur.code })}
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("reproducteurs.form.annuler")}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                >
                  {t("reproducteurs.form.supprimer")}
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
          <CardTitle className="text-base">{t("reproducteurs.detail.informations")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("reproducteurs.detail.code")}</span>
            <span className="font-medium">{reproducteur.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("reproducteurs.detail.sexe")}</span>
            <span>
              {sexeLabels[reproducteur.sexe as SexeReproducteur] ??
                reproducteur.sexe}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("reproducteurs.detail.poids")}</span>
            <span>{reproducteur.poids} {t("reproducteurs.detail.grammesUnit")}</span>
          </div>
          {reproducteur.age !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("reproducteurs.detail.age")}</span>
              <span>{reproducteur.age} {t("reproducteurs.detail.moisUnit")}</span>
            </div>
          )}
          {reproducteur.origine && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("reproducteurs.detail.origine")}</span>
              <span>{reproducteur.origine}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("reproducteurs.detail.acquisition")}</span>
            <span>
              {new Date(reproducteur.dateAcquisition).toLocaleDateString(
                "fr-FR"
              )}
            </span>
          </div>
          {reproducteur.notes && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">{t("reproducteurs.detail.notes")}</span>
              <p className="text-sm">{reproducteur.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pontes associees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("reproducteurs.pontes")} ({pontes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pontes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Egg className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t("reproducteurs.aucunePonte")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pontes.map((p) => (
                <Link key={p.id} href={`/alevins/pontes/${p.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{p.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.datePonte).toLocaleDateString("fr-FR")} —{" "}
                        {p._count.lots} {t("pontes.card.lots")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.statut === "EN_COURS"
                          ? "bg-accent-green-muted text-accent-green"
                          : p.statut === "TERMINEE"
                            ? "bg-accent-blue-muted text-accent-blue"
                            : "bg-accent-red-muted text-accent-red"
                      }`}
                    >
                      {p.statut === "EN_COURS"
                        ? t("pontes.statuts.EN_COURS")
                        : p.statut === "TERMINEE"
                          ? t("pontes.statuts.TERMINEE")
                          : t("pontes.statuts.ECHOUEE")}
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
