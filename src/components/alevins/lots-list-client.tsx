"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Baby, ArrowLeft } from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
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
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [ponteId, setPonteId] = useState("");
  const [nombreInitial, setNombreInitial] = useState("");
  const [nombreActuel, setNombreActuel] = useState("");
  const [ageJours, setAgeJours] = useState("");
  const [poidsMoyen, setPoidsMoyen] = useState("");
  const [notes, setNotes] = useState("");

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

    setCreating(true);
    try {
      const res = await fetch("/api/lots-alevins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          ponteId,
          nombreInitial: parseInt(nombreInitial, 10),
          nombreActuel: parseInt(nombreActuel, 10),
          ...(ageJours && { ageJours: parseInt(ageJours, 10) }),
          ...(poidsMoyen && { poidsMoyen: parseFloat(poidsMoyen) }),
          ...(notes.trim() && { notes: notes.trim() }),
        }),
      });

      if (res.ok) {
        toast({ title: "Lot cree", variant: "success" });
        setDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Alevins
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lots.length} lot{lots.length > 1 ? "s" : ""}
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
                Nouveau
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau lot d&apos;alevins</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label="Code"
                placeholder="Ex: LOT-2026-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
              <Select value={ponteId} onValueChange={setPonteId}>
                <SelectTrigger label="Ponte d'origine">
                  <SelectValue placeholder="Selectionnez une ponte" />
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
                label="Nombre initial"
                type="number"
                placeholder="Ex: 1000"
                value={nombreInitial}
                onChange={(e) => setNombreInitial(e.target.value)}
              />
              <Input
                label="Nombre actuel"
                type="number"
                placeholder="Ex: 980"
                value={nombreActuel}
                onChange={(e) => setNombreActuel(e.target.value)}
              />
              <Input
                label="Age en jours (optionnel)"
                type="number"
                placeholder="Ex: 5"
                value={ageJours}
                onChange={(e) => setAgeJours(e.target.value)}
              />
              <Input
                label="Poids moyen (g) (optionnel)"
                type="number"
                placeholder="Ex: 0.5"
                value={poidsMoyen}
                onChange={(e) => setPoidsMoyen(e.target.value)}
              />
              <Input
                label="Notes (optionnel)"
                placeholder="Observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={
                  creating ||
                  !code.trim() ||
                  !ponteId ||
                  !nombreInitial ||
                  !nombreActuel
                }
              >
                {creating ? <><FishLoader size="sm" /> Creation...</> : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Input
        placeholder="Rechercher par code ou ponte..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">Tous</TabsTrigger>
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
              <p className="text-muted-foreground">Aucun lot d&apos;alevins</p>
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
                              {l.nombreActuel}/{l.nombreInitial} alevins
                            </span>
                            <span>{l.ageJours}j</span>
                            {l.poidsMoyen !== null && (
                              <span>{l.poidsMoyen}g/alevins</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Ponte : {l.ponte.code}</span>
                            {l.bac && <span>Bac : {l.bac.nom}</span>}
                            {l.vagueDestination && (
                              <span>Vague : {l.vagueDestination.code}</span>
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
