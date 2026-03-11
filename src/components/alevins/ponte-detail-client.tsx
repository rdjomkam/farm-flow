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
import { useToast } from "@/components/ui/toast";
import { StatutPonte, StatutLotAlevins, Permission } from "@/types";

const statutPonteLabels: Record<StatutPonte, string> = {
  [StatutPonte.EN_COURS]: "En cours",
  [StatutPonte.TERMINEE]: "Terminee",
  [StatutPonte.ECHOUEE]: "Echouee",
};

const statutLotLabels: Record<StatutLotAlevins, string> = {
  [StatutLotAlevins.EN_INCUBATION]: "En incubation",
  [StatutLotAlevins.EN_ELEVAGE]: "En elevage",
  [StatutLotAlevins.TRANSFERE]: "Transfere",
  [StatutLotAlevins.PERDU]: "Perdu",
};

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
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleSave() {
    if (!code.trim() || !datePonte) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pontes/${ponte.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          maleId: maleId || null,
          datePonte,
          ...(nombreOeufs && { nombreOeufs: parseInt(nombreOeufs, 10) }),
          ...(tauxFecondation && {
            tauxFecondation: parseFloat(tauxFecondation),
          }),
          statut,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: "Ponte mise a jour", variant: "success" });
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
      const res = await fetch(`/api/pontes/${ponte.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Ponte supprimee", variant: "success" });
        router.push("/alevins/pontes");
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

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/alevins/pontes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Pontes
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
                Modifier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier la ponte</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label="Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
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
                  value={nombreOeufs}
                  onChange={(e) => setNombreOeufs(e.target.value)}
                />
                <Input
                  label="Taux de fecondation % (optionnel)"
                  type="number"
                  min="0"
                  max="100"
                  value={tauxFecondation}
                  onChange={(e) => setTauxFecondation(e.target.value)}
                />
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger label="Statut">
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
                  disabled={saving || !code.trim() || !datePonte}
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
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
                <DialogTitle>Supprimer la ponte</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                Etes-vous sur de vouloir supprimer{" "}
                <strong>{ponte.code}</strong> ? Cette action est irreversible.
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
            <span className="font-medium">{ponte.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>
              {new Date(ponte.datePonte).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Femelle</span>
            <Link
              href={`/alevins/reproducteurs/${ponte.femelle.id}`}
              className="text-primary hover:underline"
            >
              {ponte.femelle.code}
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Male</span>
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
              <span className="text-muted-foreground">Oeufs</span>
              <span>{ponte.nombreOeufs.toLocaleString("fr-FR")}</span>
            </div>
          )}
          {ponte.tauxFecondation !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taux fecondation</span>
              <span>{ponte.tauxFecondation}%</span>
            </div>
          )}
          {ponte.notes && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">Notes</span>
              <p className="text-sm">{ponte.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lots d'alevins */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Lots d&apos;alevins ({ponte.lots.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ponte.lots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Baby className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun lot d&apos;alevins
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
                        {l.nombreActuel}/{l.nombreInitial} alevins
                        {l.bac && ` — Bac : ${l.bac.nom}`}
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
