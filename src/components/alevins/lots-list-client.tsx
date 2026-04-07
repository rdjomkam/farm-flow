"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { Plus, Baby, ArrowLeft } from "lucide-react";
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
import { useAlevinsService } from "@/services";
import { StatutLotAlevins, Permission } from "@/types";
import { useTranslations } from "next-intl";

function statutBadgeClass(statut: string): string {
  if (statut === StatutLotAlevins.EN_INCUBATION)
    return "bg-accent-amber-muted text-accent-amber";
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
  ageJours: number;
  poidsMoyen: number | null;
  statut: string;
  ponte: { id: string; code: string };
  bac: { id: string; nom: string } | null;
  vagueDestination: { id: string; code: string } | null;
}

interface Props {
  lots: LotData[];
  pontes: { id: string; code: string }[];
  permissions: Permission[];
}

export function LotsAlevinsListClient({ lots, pontes, permissions }: Props) {
  const t = useTranslations("reproduction");
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();
  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [ponteId, setPonteId] = useState("");
  const [nombreInitial, setNombreInitial] = useState("");
  const [nombreActuel, setNombreActuel] = useState("");
  const [ageJours, setAgeJours] = useState("");
  const [poidsMoyen, setPoidsMoyen] = useState("");
  const [notes, setNotes] = useState("");

  const statutLabels: Record<StatutLotAlevins, string> = {
    [StatutLotAlevins.EN_INCUBATION]: t("alevins.lots.statuts.EN_INCUBATION"),
    [StatutLotAlevins.EN_ELEVAGE]: t("alevins.lots.statuts.EN_ELEVAGE"),
    [StatutLotAlevins.TRANSFERE]: t("alevins.lots.statuts.TRANSFERE"),
    [StatutLotAlevins.PERDU]: t("alevins.lots.statuts.PERDU"),
  };

  const filtered = lots.filter((l) => {
    const matchTab = tab === "tous" ? true : l.statut === tab;
    const matchSearch =
      !search.trim() ||
      l.code.toLowerCase().includes(search.toLowerCase()) ||
      l.ponte.code.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  function resetForm() {
    setCode("");
    setPonteId("");
    setNombreInitial("");
    setNombreActuel("");
    setAgeJours("");
    setPoidsMoyen("");
    setNotes("");
  }

  async function handleCreate() {
    if (!code.trim() || !ponteId || !nombreInitial || !nombreActuel) return;

    const result = await alevinsService.createLot({
      code: code.trim(),
      ponteId,
      nombreInitial: parseInt(nombreInitial, 10),
      nombreActuel: parseInt(nombreActuel, 10),
      ...(ageJours && { ageJours: parseInt(ageJours, 10) }),
      ...(poidsMoyen && { poidsMoyen: parseFloat(poidsMoyen) }),
      ...(notes.trim() && { notes: notes.trim() }),
    });
    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.lots() });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("alevins.lots.backToAlevins")}
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lots.length === 1
            ? t("alevins.lots.count", { count: lots.length })
            : t("alevins.lots.countPlural", { count: lots.length })}
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
                {t("alevins.lots.nouveau")}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("alevins.lots.nouveauLot")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label={t("alevins.lots.form.code")}
                placeholder={t("alevins.lots.form.codePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
              <Select value={ponteId} onValueChange={setPonteId}>
                <SelectTrigger label={t("alevins.lots.form.ponteOrigine")}>
                  <SelectValue placeholder={t("alevins.lots.form.pontePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {pontes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                label={t("alevins.lots.form.nombreInitial")}
                type="number"
                placeholder={t("alevins.lots.form.nombreInitialPlaceholder")}
                value={nombreInitial}
                onChange={(e) => setNombreInitial(e.target.value)}
              />
              <Input
                label={t("alevins.lots.form.nombreActuel")}
                type="number"
                placeholder={t("alevins.lots.form.nombreActuelPlaceholder")}
                value={nombreActuel}
                onChange={(e) => setNombreActuel(e.target.value)}
              />
              <Input
                label={t("alevins.lots.form.ageJours")}
                type="number"
                placeholder={t("alevins.lots.form.ageJoursPlaceholder")}
                value={ageJours}
                onChange={(e) => setAgeJours(e.target.value)}
              />
              <Input
                label={t("alevins.lots.form.poidsMoyen")}
                type="number"
                placeholder={t("alevins.lots.form.poidsMoyenPlaceholder")}
                value={poidsMoyen}
                onChange={(e) => setPoidsMoyen(e.target.value)}
              />
              <Input
                label={t("alevins.lots.form.notes")}
                placeholder={t("alevins.lots.form.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("alevins.lots.form.annuler")}</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={
                  !code.trim() ||
                  !ponteId ||
                  !nombreInitial ||
                  !nombreActuel
                }
              >
                {t("alevins.lots.form.creer")}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Input
        placeholder={t("alevins.lots.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">{t("alevins.lots.tabs.tous")}</TabsTrigger>
            {Object.entries(statutLabels).map(([val, label]) => (
              <TabsTrigger key={val} value={val}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Baby className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("alevins.lots.aucun")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((l) => (
                <Link key={l.id} href={`/alevins/lots/${l.id}`}>
                  <Card className="hover:ring-1 hover:ring-primary/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{l.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(l.statut)}`}
                            >
                              {statutLabels[l.statut as StatutLotAlevins] ??
                                l.statut}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              {l.nombreActuel}/{l.nombreInitial} {t("alevins.lots.card.alevins")}
                            </span>
                            <span>{l.ageJours}j</span>
                            {l.poidsMoyen !== null && (
                              <span>{l.poidsMoyen}{t("alevins.lots.detail.grammesUnit")}/{t("alevins.lots.card.alevins")}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{t("alevins.lots.card.ponte")} : {l.ponte.code}</span>
                            {l.bac && <span>{t("alevins.lots.card.bac")} : {l.bac.nom}</span>}
                            {l.vagueDestination && (
                              <span>{t("alevins.lots.card.vague")} : {l.vagueDestination.code}</span>
                            )}
                          </div>
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
