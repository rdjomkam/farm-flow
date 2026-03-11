"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [code, setCode] = useState(reproducteur.code);
  const [poids, setPoids] = useState(String(reproducteur.poids));
  const [age, setAge] = useState(reproducteur.age != null ? String(reproducteur.age) : "");
  const [origine, setOrigine] = useState(reproducteur.origine ?? "");
  const [statut, setStatut] = useState(reproducteur.statut);
  const [notes, setNotes] = useState(reproducteur.notes ?? "");

  async function handleSave() {
    if (!code.trim() || !poids) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/reproducteurs/${reproducteur.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          poids: parseFloat(poids),
          ...(age.trim() && { age: parseInt(age, 10) }),
          origine: origine.trim() || undefined,
          statut,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: "Reproducteur mis a jour", variant: "success" });
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

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reproducteurs/${reproducteur.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Reproducteur supprime", variant: "success" });
        router.push("/alevins/reproducteurs");
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
        setDeleteOpen(false);
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setDeleting(false);
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
        Reproducteurs
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
                Modifier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier le reproducteur</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label="Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Poids (g)"
                  type="number"
                  value={poids}
                  onChange={(e) => setPoids(e.target.value)}
                />
                <Input
                  label="Age en mois (optionnel)"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
                <Input
                  label="Origine (optionnel)"
                  value={origine}
                  onChange={(e) => setOrigine(e.target.value)}
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
                <Button
                  onClick={handleSave}
                  disabled={saving || !code.trim() || !poids}
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
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
                <DialogTitle>Supprimer le reproducteur</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                Etes-vous sur de vouloir supprimer{" "}
                <strong>{reproducteur.code}</strong> ? Cette action est
                irreversible.
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Suppression..." : "Supprimer"}
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
            <span className="font-medium">{reproducteur.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sexe</span>
            <span>
              {sexeLabels[reproducteur.sexe as SexeReproducteur] ??
                reproducteur.sexe}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Poids</span>
            <span>{reproducteur.poids} g</span>
          </div>
          {reproducteur.age !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Age</span>
              <span>{reproducteur.age} mois</span>
            </div>
          )}
          {reproducteur.origine && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Origine</span>
              <span>{reproducteur.origine}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Acquisition</span>
            <span>
              {new Date(reproducteur.dateAcquisition).toLocaleDateString(
                "fr-FR"
              )}
            </span>
          </div>
          {reproducteur.notes && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">Notes</span>
              <p className="text-sm">{reproducteur.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pontes associees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Pontes ({pontes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pontes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Egg className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucune ponte</p>
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
                        {p._count.lots} lot(s)
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
                        ? "En cours"
                        : p.statut === "TERMINEE"
                          ? "Terminee"
                          : "Echouee"}
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
