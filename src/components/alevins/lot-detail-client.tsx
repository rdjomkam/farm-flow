"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, ArrowRightLeft, Waves } from "lucide-react";
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
import { StatutLotAlevins, Permission } from "@/types";
import { useTranslations } from "next-intl";

function statutBadgeClass(statut: string): string {
  if (statut === StatutLotAlevins.EN_INCUBATION)
    return "bg-accent-yellow-muted text-accent-yellow";
  if (statut === StatutLotAlevins.EN_ELEVAGE)
    return "bg-accent-green-muted text-accent-green";
  if (statut === StatutLotAlevins.TRANSFERE)
    return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

interface BacLibre {
  id: string;
  nom: string;
}

interface LotData {
  id: string;
  code: string;
  nombreInitial: number;
  nombreActuel: number;
  ageJours: number;
  poidsMoyen: number | null;
  statut: string;
  dateTransfert: string | null;
  notes: string | null;
  ponte: {
    id: string;
    code: string;
    femelle: { id: string; code: string; sexe: string };
    male: { id: string; code: string; sexe: string } | null;
  };
  bac: {
    id: string;
    nom: string;
    volume: number;
  } | null;
  vagueDestination: {
    id: string;
    code: string;
    bacs: { id: string; nom: string }[];
  } | null;
}

interface Props {
  lot: LotData;
  bacsLibres: BacLibre[];
  permissions: Permission[];
}

export function LotAlevinsDetailClient({ lot, bacsLibres, permissions }: Props) {
  const t = useTranslations("alevins");
  const router = useRouter();
  const alevinsService = useAlevinsService();
  const [editOpen, setEditOpen] = useState(false);
  const [transfertOpen, setTransfertOpen] = useState(false);

  // Edit form state
  const [nombreActuel, setNombreActuel] = useState(String(lot.nombreActuel));
  const [ageJours, setAgeJours] = useState(String(lot.ageJours));
  const [poidsMoyen, setPoidsMoyen] = useState(
    lot.poidsMoyen !== null ? String(lot.poidsMoyen) : ""
  );
  const [statut, setStatut] = useState(lot.statut);
  const [notes, setNotes] = useState(lot.notes ?? "");

  // Transfert form state
  const [nomVague, setNomVague] = useState("");
  const [selectedBacs, setSelectedBacs] = useState<string[]>([]);

  const statutLabels: Record<StatutLotAlevins, string> = {
    [StatutLotAlevins.EN_INCUBATION]: t("lots.statuts.EN_INCUBATION"),
    [StatutLotAlevins.EN_ELEVAGE]: t("lots.statuts.EN_ELEVAGE"),
    [StatutLotAlevins.TRANSFERE]: t("lots.statuts.TRANSFERE"),
    [StatutLotAlevins.PERDU]: t("lots.statuts.PERDU"),
  };

  function toggleBac(bacId: string) {
    setSelectedBacs((prev) =>
      prev.includes(bacId) ? prev.filter((id) => id !== bacId) : [...prev, bacId]
    );
  }

  async function handleSave() {
    const result = await alevinsService.updateLot(lot.id, {
      nombreActuel: parseInt(nombreActuel, 10),
      ageJours: parseInt(ageJours, 10),
      ...(poidsMoyen && { poidsMoyen: parseFloat(poidsMoyen) }),
      statut: statut as StatutLotAlevins,
      notes: notes.trim() || undefined,
    });
    if (result.ok) {
      setEditOpen(false);
      router.refresh();
    }
  }

  async function handleTransfert() {
    if (!nomVague.trim() || selectedBacs.length === 0) return;

    const result = await alevinsService.transfererLot(lot.id, {
      nom: nomVague.trim(),
      bacIds: selectedBacs,
    });
    if (result.ok) {
      setTransfertOpen(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins/lots"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("lots.backToLots")}
      </Link>

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statutBadgeClass(lot.statut)}`}
        >
          {statutLabels[lot.statut as StatutLotAlevins] ?? lot.statut}
        </span>
        <div className="flex items-center gap-2">
          {permissions.includes(Permission.ALEVINS_MODIFIER) && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-1" />
                {t("lots.form.enregistrer")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("lots.modifierLot")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label={t("lots.form.nombreActuel")}
                  type="number"
                  value={nombreActuel}
                  onChange={(e) => setNombreActuel(e.target.value)}
                  autoFocus
                />
                <Input
                  label={t("lots.form.ageJours")}
                  type="number"
                  value={ageJours}
                  onChange={(e) => setAgeJours(e.target.value)}
                />
                <Input
                  label={t("lots.form.poidsMoyen")}
                  type="number"
                  value={poidsMoyen}
                  onChange={(e) => setPoidsMoyen(e.target.value)}
                />
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger label={t("lots.form.statut")}>
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
                  label={t("lots.form.notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("lots.form.annuler")}</Button>
                </DialogClose>
                <Button onClick={handleSave}>
                  {t("lots.form.enregistrer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}

          {permissions.includes(Permission.ALEVINS_MODIFIER) && lot.statut === StatutLotAlevins.EN_ELEVAGE && (
            <Dialog
              open={transfertOpen}
              onOpenChange={(open) => {
                setTransfertOpen(open);
                if (!open) {
                  setNomVague("");
                  setSelectedBacs([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  {t("lots.transfert.button")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("lots.transfert.title")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    {t("lots.transfert.description", { count: lot.nombreActuel })}
                  </p>
                  <Input
                    label={t("lots.form.nomVague")}
                    placeholder={t("lots.form.nomVaguePlaceholder")}
                    value={nomVague}
                    onChange={(e) => setNomVague(e.target.value)}
                    autoFocus
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      {t("lots.form.bacsAssigner")}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({bacsLibres.length === 1
                          ? t("lots.form.bacsDisponibles", { count: bacsLibres.length })
                          : t("lots.form.bacsDisponiblesPlural", { count: bacsLibres.length })})
                      </span>
                    </p>
                    {bacsLibres.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("lots.form.aucunBacLibre")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                        {bacsLibres.map((b) => (
                          <label
                            key={b.id}
                            className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors min-h-[44px]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedBacs.includes(b.id)}
                              onChange={() => toggleBac(b.id)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="text-sm">{b.nom}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedBacs.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedBacs.length === 1
                          ? t("lots.form.bacsSelectionnes", { count: selectedBacs.length })
                          : t("lots.form.bacsSelectionnesPlural", { count: selectedBacs.length })}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("lots.transfert.annuler")}</Button>
                  </DialogClose>
                  <Button
                    onClick={handleTransfert}
                    disabled={
                      !nomVague.trim() ||
                      selectedBacs.length === 0
                    }
                  >
                    {t("lots.transfert.confirm")}
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
          <CardTitle className="text-base">{t("lots.detail.informations")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("lots.detail.code")}</span>
            <span className="font-medium">{lot.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("lots.detail.alevins")}</span>
            <span>
              {lot.nombreActuel} / {lot.nombreInitial} ({t("lots.detail.initial")})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("lots.detail.age")}</span>
            <span>{lot.ageJours} {t("lots.detail.jourUnit")}</span>
          </div>
          {lot.poidsMoyen !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("lots.detail.poidsMoyen")}</span>
              <span>{lot.poidsMoyen} {t("lots.detail.grammesUnit")}</span>
            </div>
          )}
          {lot.bac && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("lots.detail.bacActuel")}</span>
              <span>{lot.bac.nom}</span>
            </div>
          )}
          {lot.dateTransfert && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("lots.detail.dateTransfert")}</span>
              <span>
                {new Date(lot.dateTransfert).toLocaleDateString("fr-FR")}
              </span>
            </div>
          )}
          {lot.notes && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">{t("lots.detail.notes")}</span>
              <p className="text-sm">{lot.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ponte parente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("lots.detail.ponteOrigine")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href={`/alevins/pontes/${lot.ponte.id}`}
            className="flex items-center justify-between hover:bg-muted/50 rounded-lg px-2 py-2 -mx-2 transition-colors"
          >
            <span className="font-medium text-primary">{lot.ponte.code}</span>
            <div className="text-xs text-muted-foreground">
              <span>{t("pontes.card.femelle")} : {lot.ponte.femelle.code}</span>
              {lot.ponte.male && <span> — {t("pontes.card.male")} : {lot.ponte.male.code}</span>}
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Vague de destination (si transfere) */}
      {lot.statut === StatutLotAlevins.TRANSFERE && lot.vagueDestination && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />
              {t("lots.detail.vagueDestination")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/vagues/${lot.vagueDestination.id}`}
              className="flex items-center justify-between hover:bg-muted/50 rounded-lg px-2 py-2 -mx-2 transition-colors"
            >
              <span className="font-medium text-primary">
                {lot.vagueDestination.code}
              </span>
              <span className="text-xs text-muted-foreground">
                {lot.vagueDestination.bacs.length} {t("lots.card.bac")}
                {lot.vagueDestination.bacs.length > 1 ? "s" : ""}
              </span>
            </Link>
            {lot.vagueDestination.bacs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {lot.vagueDestination.bacs.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {b.nom}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
