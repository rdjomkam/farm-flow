"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { Plus, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { SexeReproducteur, StatutReproducteur, Permission } from "@/types";
import { useAlevinsService } from "@/services";
import { useTranslations, useLocale } from "next-intl";

function sexeBadgeClass(sexe: string): string {
  if (sexe === SexeReproducteur.FEMELLE) return "bg-accent-purple-muted text-accent-purple";
  return "bg-accent-blue-muted text-accent-blue";
}

function statutBadgeClass(statut: string): string {
  if (statut === StatutReproducteur.ACTIF)
    return "bg-accent-green-muted text-accent-green";
  if (statut === StatutReproducteur.REFORME)
    return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
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
  _count: { pontesAsFemelle: number; pontesAsMale: number };
}

interface Props {
  reproducteurs: ReproducteurData[];
  permissions: Permission[];
}

export function ReproducteursListClient({ reproducteurs, permissions }: Props) {
  const t = useTranslations("reproduction");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();
  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [sexe, setSexe] = useState<string>(SexeReproducteur.FEMELLE);
  const [poids, setPoids] = useState("");
  const [age, setAge] = useState("");
  const [origine, setOrigine] = useState("");
  const [notes, setNotes] = useState("");
  const [dateAcquisition, setDateAcquisition] = useState("");

  const sexeLabels: Record<SexeReproducteur, string> = {
    [SexeReproducteur.MALE]: t("alevins.reproducteurs.sexe.MALE"),
    [SexeReproducteur.FEMELLE]: t("alevins.reproducteurs.sexe.FEMELLE"),
  };

  const statutLabels: Record<StatutReproducteur, string> = {
    [StatutReproducteur.ACTIF]: t("alevins.reproducteurs.statuts.ACTIF"),
    [StatutReproducteur.EN_REPOS]: t("alevins.reproducteurs.statuts.EN_REPOS"),
    [StatutReproducteur.REFORME]: t("alevins.reproducteurs.statuts.REFORME"),
    [StatutReproducteur.SACRIFIE]: t("alevins.reproducteurs.statuts.SACRIFIE"),
    [StatutReproducteur.MORT]: t("alevins.reproducteurs.statuts.MORT"),
  };

  const filtered = reproducteurs.filter((r) => {
    const matchTab =
      tab === "tous"
        ? true
        : tab === "males"
          ? r.sexe === SexeReproducteur.MALE
          : tab === "femelles"
            ? r.sexe === SexeReproducteur.FEMELLE
            : r.statut === tab;
    const matchSearch =
      !search.trim() ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.origine ?? "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  function resetForm() {
    setCode("");
    setSexe(SexeReproducteur.FEMELLE);
    setPoids("");
    setAge("");
    setOrigine("");
    setNotes("");
    setDateAcquisition("");
  }

  async function handleCreate() {
    if (!code.trim() || !poids) return;

    const result = await alevinsService.createReproducteur({
      code: code.trim(),
      sexe: sexe as Parameters<typeof alevinsService.createReproducteur>[0]["sexe"],
      poids: parseFloat(poids),
      ...(age.trim() && { age: parseInt(age, 10) }),
      ...(origine.trim() && { origine: origine.trim() }),
      ...(notes.trim() && { notes: notes.trim() }),
      ...(dateAcquisition && { dateAcquisition }),
    });
    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.reproducteurs() });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("alevins.reproducteurs.backToAlevins")}
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {reproducteurs.length === 1
            ? t("alevins.reproducteurs.count", { count: reproducteurs.length })
            : t("alevins.reproducteurs.countPlural", { count: reproducteurs.length })}
        </p>
        {permissions.includes(Permission.ALEVINS_GERER) && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("alevins.reproducteurs.nouveau")}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("alevins.reproducteurs.ajouterReproducteur")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label={t("alevins.reproducteurs.form.code")}
                placeholder={t("alevins.reproducteurs.form.codePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
              <Select value={sexe} onValueChange={setSexe}>
                <SelectTrigger label={t("alevins.reproducteurs.form.sexe")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sexeLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                label={t("alevins.reproducteurs.form.poids")}
                type="number"
                placeholder={t("alevins.reproducteurs.form.poidsPlaceholder")}
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
              />
              <Input
                label={t("alevins.reproducteurs.form.age")}
                type="number"
                placeholder={t("alevins.reproducteurs.form.agePlaceholder")}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <Input
                label={t("alevins.reproducteurs.form.origine")}
                placeholder={t("alevins.reproducteurs.form.originePlaceholder")}
                value={origine}
                onChange={(e) => setOrigine(e.target.value)}
              />
              <Input
                label={t("alevins.reproducteurs.form.dateAcquisition")}
                type="date"
                value={dateAcquisition}
                onChange={(e) => setDateAcquisition(e.target.value)}
              />
              <Input
                label={t("alevins.reproducteurs.form.notes")}
                placeholder={t("alevins.reproducteurs.form.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("alevins.reproducteurs.form.annuler")}</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={!code.trim() || !poids}
              >
                {t("alevins.reproducteurs.form.creer")}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Input
        placeholder={t("alevins.reproducteurs.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">{t("alevins.reproducteurs.tabs.tous")}</TabsTrigger>
            <TabsTrigger value="femelles">{t("alevins.reproducteurs.tabs.femelles")}</TabsTrigger>
            <TabsTrigger value="males">{t("alevins.reproducteurs.tabs.males")}</TabsTrigger>
            <TabsTrigger value={StatutReproducteur.ACTIF}>{t("alevins.reproducteurs.tabs.actifs")}</TabsTrigger>
            <TabsTrigger value={StatutReproducteur.REFORME}>
              {t("alevins.reproducteurs.tabs.reformes")}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("alevins.reproducteurs.aucun")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((r) => (
                <Link key={r.id} href={`/alevins/reproducteurs/${r.id}`}>
                  <Card className="hover:ring-1 hover:ring-primary/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{r.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sexeBadgeClass(r.sexe)}`}
                            >
                              {sexeLabels[r.sexe as SexeReproducteur] ?? r.sexe}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(r.statut)}`}
                            >
                              {statutLabels[r.statut as StatutReproducteur] ??
                                r.statut}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>{r.poids} {t("alevins.reproducteurs.detail.grammesUnit")}</span>
                            {r.age !== null && (
                              <span>{r.age} {t("alevins.reproducteurs.detail.moisUnit")}</span>
                            )}
                            {r.origine && (
                              <span className="truncate">{r.origine}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>
                            {new Date(r.dateAcquisition).toLocaleDateString(
                              locale
                            )}
                          </p>
                          <p className="mt-0.5">
                            {r._count.pontesAsFemelle +
                              r._count.pontesAsMale}{" "}
                            {t("alevins.reproducteurs.pontes")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
