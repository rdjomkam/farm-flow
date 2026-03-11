"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { SexeReproducteur, StatutReproducteur, Permission } from "@/types";

const sexeLabels: Record<SexeReproducteur, string> = {
  [SexeReproducteur.MALE]: "Male",
  [SexeReproducteur.FEMELLE]: "Femelle",
};

const statutLabels: Record<StatutReproducteur, string> = {
  [StatutReproducteur.ACTIF]: "Actif",
  [StatutReproducteur.REFORME]: "Reforme",
  [StatutReproducteur.MORT]: "Mort",
};

function statutBadgeClass(statut: string): string {
  if (statut === StatutReproducteur.ACTIF)
    return "bg-accent-green-muted text-accent-green";
  if (statut === StatutReproducteur.REFORME)
    return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

function sexeBadgeClass(sexe: string): string {
  if (sexe === SexeReproducteur.FEMELLE) return "bg-accent-pink-muted text-accent-pink";
  return "bg-accent-indigo-muted text-accent-indigo";
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
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [sexe, setSexe] = useState<string>(SexeReproducteur.FEMELLE);
  const [poids, setPoids] = useState("");
  const [age, setAge] = useState("");
  const [origine, setOrigine] = useState("");
  const [notes, setNotes] = useState("");
  const [dateAcquisition, setDateAcquisition] = useState("");

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

    setCreating(true);
    try {
      const res = await fetch("/api/reproducteurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          sexe,
          poids: parseFloat(poids),
          ...(age.trim() && { age: parseInt(age, 10) }),
          ...(origine.trim() && { origine: origine.trim() }),
          ...(notes.trim() && { notes: notes.trim() }),
          ...(dateAcquisition && { dateAcquisition }),
        }),
      });

      if (res.ok) {
        toast({ title: "Reproducteur cree", variant: "success" });
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
          {reproducteurs.length} reproducteur
          {reproducteurs.length > 1 ? "s" : ""}
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
              <DialogTitle>Ajouter un reproducteur</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label="Code"
                placeholder="Ex: REP-F-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
              <Select value={sexe} onValueChange={setSexe}>
                <SelectTrigger label="Sexe">
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
                label="Poids (g)"
                type="number"
                placeholder="Ex: 1500"
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
              />
              <Input
                label="Age en mois (optionnel)"
                type="number"
                placeholder="Ex: 18"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <Input
                label="Origine (optionnel)"
                placeholder="Ex: Ecloserie Yaounde"
                value={origine}
                onChange={(e) => setOrigine(e.target.value)}
              />
              <Input
                label="Date d'acquisition (optionnel)"
                type="date"
                value={dateAcquisition}
                onChange={(e) => setDateAcquisition(e.target.value)}
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
                disabled={creating || !code.trim() || !poids}
              >
                {creating ? "Creation..." : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Input
        placeholder="Rechercher par code ou origine..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">Tous</TabsTrigger>
            <TabsTrigger value="femelles">Femelles</TabsTrigger>
            <TabsTrigger value="males">Males</TabsTrigger>
            <TabsTrigger value={StatutReproducteur.ACTIF}>Actifs</TabsTrigger>
            <TabsTrigger value={StatutReproducteur.REFORME}>
              Reformes
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun reproducteur</p>
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
                            <span>{r.poids} g</span>
                            {r.age !== null && (
                              <span>{r.age} mois</span>
                            )}
                            {r.origine && (
                              <span className="truncate">{r.origine}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>
                            {new Date(r.dateAcquisition).toLocaleDateString(
                              "fr-FR"
                            )}
                          </p>
                          <p className="mt-0.5">
                            {r._count.pontesAsFemelle +
                              r._count.pontesAsMale}{" "}
                            ponte(s)
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
