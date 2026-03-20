"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Clock, ToggleLeft, ToggleRight, Pencil, Trash2 } from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CategorieDepense, FrequenceRecurrence } from "@/types";
import type { CreateDepenseRecurrenteDTO } from "@/types";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const frequenceLabels: Record<FrequenceRecurrence, string> = {
  [FrequenceRecurrence.MENSUEL]: "Mensuel",
  [FrequenceRecurrence.TRIMESTRIEL]: "Trimestriel",
  [FrequenceRecurrence.ANNUEL]: "Annuel",
};

const categorieLabels: Record<CategorieDepense, string> = {
  [CategorieDepense.ALIMENT]: "Aliment",
  [CategorieDepense.INTRANT]: "Intrant",
  [CategorieDepense.EQUIPEMENT]: "Equipement",
  [CategorieDepense.ELECTRICITE]: "Electricite",
  [CategorieDepense.EAU]: "Eau",
  [CategorieDepense.LOYER]: "Loyer",
  [CategorieDepense.SALAIRE]: "Salaire",
  [CategorieDepense.TRANSPORT]: "Transport",
  [CategorieDepense.VETERINAIRE]: "Veterinaire",
  [CategorieDepense.REPARATION]: "Reparation",
  [CategorieDepense.INVESTISSEMENT]: "Investissement",
  [CategorieDepense.AUTRE]: "Autre",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateData {
  id: string;
  description: string;
  categorieDepense: string;
  montantEstime: number;
  frequence: string;
  jourDuMois: number;
  isActive: boolean;
  derniereGeneration: string | null;
  user: { id: string; name: string };
}

interface Props {
  templates: TemplateData[];
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component principal
// ---------------------------------------------------------------------------

export function RecurrentesListClient({ templates: initial, canManage }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState(initial);
  const [generating, setGenerating] = useState(false);

  // Dialog creation
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState<Partial<CreateDepenseRecurrenteDTO>>({
    frequence: FrequenceRecurrence.MENSUEL,
    jourDuMois: 1,
    isActive: true,
  });

  // Dialog suppression
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleGenerer() {
    setGenerating(true);
    try {
      const res = await fetch("/api/depenses-recurrentes/generer", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Erreur");
      }
      const data = await res.json();
      if (data.generated === 0) {
        toast({ title: "Aucune depense a generer pour cette periode." });
      } else {
        toast({
          title: `${data.generated} depense${data.generated > 1 ? "s" : ""} generee${data.generated > 1 ? "s" : ""} avec succes`,
          variant: "success",
        });
      }
      router.refresh();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleActive(template: TemplateData) {
    try {
      const res = await fetch(`/api/depenses-recurrentes/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Erreur");
      }
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, isActive: !t.isActive } : t
        )
      );
      toast({
        title: template.isActive ? "Template desactive" : "Template active",
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    }
  }

  async function handleCreate() {
    if (!form.description || !form.categorieDepense || !form.montantEstime || !form.frequence) {
      toast({ title: "Remplissez tous les champs obligatoires.", variant: "error" });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/depenses-recurrentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Erreur");
      }
      const newTemplate = await res.json();
      setTemplates((prev) => [newTemplate, ...prev]);
      setCreateOpen(false);
      setForm({ frequence: FrequenceRecurrence.MENSUEL, jourDuMois: 1, isActive: true });
      toast({ title: "Template cree avec succes", variant: "success" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/depenses-recurrentes/${deletingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Erreur");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== deletingId));
      setDeleteOpen(false);
      setDeletingId(null);
      toast({ title: "Template supprime" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    }
  }

  const actifs = templates.filter((t) => t.isActive);
  const inactifs = templates.filter((t) => !t.isActive);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleGenerer}
          disabled={generating}
        >
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generation..." : "Generer maintenant"}
        </Button>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau template recurrent</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Description *</label>
                  <Input
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Loyer atelier pisciculture"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Categorie *</label>
                  <Select
                    value={form.categorieDepense}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, categorieDepense: v as CategorieDepense }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CategorieDepense).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {categorieLabels[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Montant estime (FCFA) *</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.montantEstime ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, montantEstime: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="Ex: 150000"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Frequence *</label>
                  <Select
                    value={form.frequence}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, frequence: v as FrequenceRecurrence }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FrequenceRecurrence).map((freq) => (
                        <SelectItem key={freq} value={freq}>
                          {frequenceLabels[freq]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Jour du mois (1-28)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.jourDuMois ?? 1}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        jourDuMois: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)),
                      }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={createLoading}>
                    Annuler
                  </Button>
                </DialogClose>
                <Button onClick={handleCreate} disabled={createLoading}>
                  {createLoading ? <><FishLoader size="sm" /> Creation...</> : "Creer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Templates actifs */}
      {actifs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Actifs ({actifs.length})
          </h2>
          <div className="flex flex-col gap-3">
            {actifs.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                canManage={canManage}
                onToggle={handleToggleActive}
                onDelete={(id) => {
                  setDeletingId(id);
                  setDeleteOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Templates inactifs */}
      {inactifs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Inactifs ({inactifs.length})
          </h2>
          <div className="flex flex-col gap-3">
            {inactifs.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                canManage={canManage}
                onToggle={handleToggleActive}
                onDelete={(id) => {
                  setDeletingId(id);
                  setDeleteOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Clock className="h-10 w-10 opacity-30" />
          <p className="text-sm">Aucun template recurrent</p>
          {canManage && (
            <p className="text-xs">Cliquez sur &quot;Nouveau&quot; pour en creer un.</p>
          )}
        </div>
      )}

      {/* Dialog confirmation suppression */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le template ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ce template sera definitivement supprime. Les depenses deja generees
            ne seront pas affectees.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setDeletingId(null);
                }}
              >
                Annuler
              </Button>
            </DialogClose>
            <Button variant="danger" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateCard
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  canManage,
  onToggle,
  onDelete,
}: {
  template: TemplateData;
  canManage: boolean;
  onToggle: (t: TemplateData) => void;
  onDelete: (id: string) => void;
}) {
  const frequence = template.frequence as FrequenceRecurrence;
  const categorie = template.categorieDepense as CategorieDepense;

  return (
    <Card className={template.isActive ? "" : "opacity-60"}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">{template.description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {categorieLabels[categorie]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={template.isActive ? "en_cours" : "default"}>
              {template.isActive ? "Actif" : "Inactif"}
            </Badge>
            <Badge variant="info" className="text-xs">
              {frequenceLabels[frequence]}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Montant estime : </span>
            <span className="font-semibold">
              {new Intl.NumberFormat("fr-FR").format(Math.round(template.montantEstime))} FCFA
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Jour {template.jourDuMois} du mois
          </div>
        </div>

        {template.derniereGeneration && (
          <p className="text-xs text-muted-foreground">
            Derniere generation : {formatDate(template.derniereGeneration)}
          </p>
        )}

        {canManage && (
          <div className="flex items-center gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 flex-1"
              onClick={() => onToggle(template)}
            >
              {template.isActive ? (
                <>
                  <ToggleRight className="h-4 w-4" />
                  Desactiver
                </>
              ) : (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  Activer
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-danger border-danger/30 hover:bg-danger/5"
              onClick={() => onDelete(template.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
