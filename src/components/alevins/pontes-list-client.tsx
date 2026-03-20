"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Egg, ArrowLeft } from "lucide-react";
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
import { StatutPonte, Permission } from "@/types";
import { useAlevinsService } from "@/services";

const statutLabels: Record<StatutPonte, string> = {
  [StatutPonte.EN_COURS]: "En cours",
  [StatutPonte.TERMINEE]: "Terminee",
  [StatutPonte.ECHOUEE]: "Echouee",
};

function statutBadgeClass(statut: string): string {
  if (statut === StatutPonte.EN_COURS) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutPonte.TERMINEE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

interface PonteData {
  id: string;
  code: string;
  datePonte: string;
  nombreOeufs: number | null;
  tauxFecondation: number | null;
  statut: string;
  femelle: { id: string; code: string; sexe: string; poids: number };
  male: { id: string; code: string; sexe: string; poids: number } | null;
  _count: { lots: number };
}

interface Props {
  pontes: PonteData[];
  femelles: { id: string; code: string }[];
  males: { id: string; code: string }[];
  permissions: Permission[];
}

export function PontesListClient({ pontes, femelles, males, permissions }: Props) {
  const router = useRouter();
  const alevinsService = useAlevinsService();
  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [femelleId, setFemelleId] = useState("");
  const [maleId, setMaleId] = useState("");
  const [datePonte, setDatePonte] = useState("");
  const [nombreOeufs, setNombreOeufs] = useState("");
  const [tauxFecondation, setTauxFecondation] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = pontes.filter((p) => {
    const matchTab =
      tab === "tous" ? true : p.statut === tab;
    const matchSearch =
      !search.trim() ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.femelle.code.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  function resetForm() {
    setCode("");
    setFemelleId("");
    setMaleId("");
    setDatePonte("");
    setNombreOeufs("");
    setTauxFecondation("");
    setNotes("");
  }

  async function handleCreate() {
    if (!code.trim() || !femelleId || !datePonte) return;

    const result = await alevinsService.createPonte({
      code: code.trim(),
      femelleId,
      ...(maleId && { maleId }),
      datePonte,
      ...(nombreOeufs && { nombreOeufs: parseInt(nombreOeufs, 10) }),
      ...(tauxFecondation && { tauxFecondation: parseFloat(tauxFecondation) }),
      ...(notes.trim() && { notes: notes.trim() }),
    });
    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      router.refresh();
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
          {pontes.length} ponte{pontes.length > 1 ? "s" : ""}
        </p>
        {permissions.includes(Permission.ALEVINS_CREER) && (
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
                Nouvelle
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle ponte</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label="Code"
                placeholder="Ex: PONTE-2026-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
              <Select value={femelleId} onValueChange={setFemelleId}>
                <SelectTrigger label="Femelle">
                  <SelectValue placeholder="Selectionnez une femelle" />
                </SelectTrigger>
                <SelectContent>
                  {femelles.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={maleId} onValueChange={setMaleId}>
                <SelectTrigger label="Male (optionnel)">
                  <SelectValue placeholder="Aucun male identifie" />
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
                label="Date de ponte"
                type="date"
                value={datePonte}
                onChange={(e) => setDatePonte(e.target.value)}
              />
              <Input
                label="Nombre d'oeufs (optionnel)"
                type="number"
                placeholder="Ex: 5000"
                value={nombreOeufs}
                onChange={(e) => setNombreOeufs(e.target.value)}
              />
              <Input
                label="Taux de fecondation % (optionnel)"
                type="number"
                placeholder="Ex: 75"
                min="0"
                max="100"
                value={tauxFecondation}
                onChange={(e) => setTauxFecondation(e.target.value)}
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
                disabled={!code.trim() || !femelleId || !datePonte}
              >
                Creer
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Input
        placeholder="Rechercher par code ou femelle..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">Toutes</TabsTrigger>
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
              <Egg className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune ponte</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((p) => (
                <Link key={p.id} href={`/alevins/pontes/${p.id}`}>
                  <Card className="hover:ring-1 hover:ring-primary/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{p.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(p.statut)}`}
                            >
                              {statutLabels[p.statut as StatutPonte] ?? p.statut}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>Femelle : {p.femelle.code}</span>
                            <span>
                              Male : {p.male ? p.male.code : "—"}
                            </span>
                          </div>
                          {(p.nombreOeufs !== null ||
                            p.tauxFecondation !== null) && (
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {p.nombreOeufs !== null && (
                                <span>{p.nombreOeufs.toLocaleString("fr-FR")} oeufs</span>
                              )}
                              {p.tauxFecondation !== null && (
                                <span>{p.tauxFecondation}% fecondation</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>
                            {new Date(p.datePonte).toLocaleDateString("fr-FR")}
                          </p>
                          <p className="mt-0.5">{p._count.lots} lot(s)</p>
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
