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
import { useToast } from "@/components/ui/toast";
import { StatutLotAlevins, Permission } from "@/types";

const statutLabels: Record<StatutLotAlevins, string> = {
  [StatutLotAlevins.EN_INCUBATION]: "En incubation",
  [StatutLotAlevins.EN_ELEVAGE]: "En elevage",
  [StatutLotAlevins.TRANSFERE]: "Transfere",
  [StatutLotAlevins.PERDU]: "Perdu",
};

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
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [transfertOpen, setTransfertOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);

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

  function toggleBac(bacId: string) {
    setSelectedBacs((prev) =>
      prev.includes(bacId) ? prev.filter((id) => id !== bacId) : [...prev, bacId]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/lots-alevins/${lot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreActuel: parseInt(nombreActuel, 10),
          ageJours: parseInt(ageJours, 10),
          ...(poidsMoyen && { poidsMoyen: parseFloat(poidsMoyen) }),
          statut,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: "Lot mis a jour", variant: "success" });
        setEditOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTransfert() {
    if (!nomVague.trim() || selectedBacs.length === 0) return;

    setTransferring(true);
    try {
      const res = await fetch(`/api/lots-alevins/${lot.id}/transferer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nomVague.trim(),
          bacIds: selectedBacs,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Transfert effectue",
          description: `Nouvelle vague : ${data.vague?.code ?? ""}`,
          variant: "success",
        });
        setTransfertOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins/lots"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Lots d&apos;alevins
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
                Modifier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier le lot</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label="Nombre actuel"
                  type="number"
                  value={nombreActuel}
                  onChange={(e) => setNombreActuel(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Age en jours"
                  type="number"
                  value={ageJours}
                  onChange={(e) => setAgeJours(e.target.value)}
                />
                <Input
                  label="Poids moyen (g) (optionnel)"
                  type="number"
                  value={poidsMoyen}
                  onChange={(e) => setPoidsMoyen(e.target.value)}
                />
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger label="Statut">
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
                  label="Notes (optionnel)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
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
                  Transferer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferer vers une vague</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Un transfert va creer une nouvelle vague de grossissement
                    avec {lot.nombreActuel} alevins.
                  </p>
                  <Input
                    label="Nom de la nouvelle vague"
                    placeholder="Ex: Vague Alevins Mars 2026"
                    value={nomVague}
                    onChange={(e) => setNomVague(e.target.value)}
                    autoFocus
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      Bacs a assigner{" "}
                      <span className="text-muted-foreground font-normal">
                        ({bacsLibres.length} disponible
                        {bacsLibres.length > 1 ? "s" : ""})
                      </span>
                    </p>
                    {bacsLibres.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun bac libre disponible. Liberez des bacs avant de
                        transferer.
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
                        {selectedBacs.length} bac
                        {selectedBacs.length > 1 ? "s" : ""} selectionne
                        {selectedBacs.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Annuler</Button>
                  </DialogClose>
                  <Button
                    onClick={handleTransfert}
                    disabled={
                      transferring ||
                      !nomVague.trim() ||
                      selectedBacs.length === 0
                    }
                  >
                    {transferring ? "Transfert..." : "Confirmer le transfert"}
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
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Code</span>
            <span className="font-medium">{lot.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Alevins</span>
            <span>
              {lot.nombreActuel} / {lot.nombreInitial} (initial)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Age</span>
            <span>{lot.ageJours} jours</span>
          </div>
          {lot.poidsMoyen !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poids moyen</span>
              <span>{lot.poidsMoyen} g</span>
            </div>
          )}
          {lot.bac && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bac actuel</span>
              <span>{lot.bac.nom}</span>
            </div>
          )}
          {lot.dateTransfert && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date transfert</span>
              <span>
                {new Date(lot.dateTransfert).toLocaleDateString("fr-FR")}
              </span>
            </div>
          )}
          {lot.notes && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">Notes</span>
              <p className="text-sm">{lot.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ponte parente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ponte d&apos;origine</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href={`/alevins/pontes/${lot.ponte.id}`}
            className="flex items-center justify-between hover:bg-muted/50 rounded-lg px-2 py-2 -mx-2 transition-colors"
          >
            <span className="font-medium text-primary">{lot.ponte.code}</span>
            <div className="text-xs text-muted-foreground">
              <span>Femelle : {lot.ponte.femelle.code}</span>
              {lot.ponte.male && <span> — Male : {lot.ponte.male.code}</span>}
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
              Vague de destination
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
                {lot.vagueDestination.bacs.length} bac
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
