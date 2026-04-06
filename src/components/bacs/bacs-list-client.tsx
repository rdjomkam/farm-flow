"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Container, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockedResourceOverlay } from "@/components/ui/blocked-resource-overlay";
import { Permission, TypeSystemeBac } from "@/types";
import type { BacResponse } from "@/types";
import { useCreateBac, useUpdateBac, useBacsList } from "@/hooks/queries/use-bacs-queries";

interface BacsListClientProps {
  bacs: BacResponse[];
  permissions: Permission[];
}

export function BacsListClient({ bacs: initialBacs, permissions }: BacsListClientProps) {
  const t = useTranslations("bacs");
  const createBacMutation = useCreateBac();
  const updateBacMutation = useUpdateBac();
  const { data: bacs = initialBacs } = useBacsList(undefined, { initialData: initialBacs });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [volume, setVolume] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editBac, setEditBac] = useState<BacResponse | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editVolume, setEditVolume] = useState("");
  const [editNombrePoissons, setEditNombrePoissons] = useState("");
  const [editNombreInitial, setEditNombreInitial] = useState("");
  const [editPoidsMoyenInitial, setEditPoidsMoyenInitial] = useState("");
  const [editTypeSysteme, setEditTypeSysteme] = useState<string>("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setNom("");
    setVolume("");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!nom.trim()) newErrors.nom = t("createDialog.erreurs.nomRequis");
    if (!volume || Number(volume) <= 0) newErrors.volume = t("createDialog.erreurs.volumePositif");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      await createBacMutation.mutateAsync({ nom: nom.trim(), volume: Number(volume) });
      setDialogOpen(false);
      resetForm();
    } catch {
      // Error already handled by useApi toast
    }
  }

  function openEdit(bac: BacResponse) {
    setEditBac(bac);
    setEditNom(bac.nom);
    setEditVolume(String(bac.volume));
    setEditNombrePoissons(bac.nombrePoissons != null ? String(bac.nombrePoissons) : "");
    setEditNombreInitial(bac.nombreInitial != null ? String(bac.nombreInitial) : "");
    setEditPoidsMoyenInitial(bac.poidsMoyenInitial != null ? String(bac.poidsMoyenInitial) : "");
    setEditTypeSysteme(bac.typeSysteme ?? "");
    setEditErrors({});
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!editNom.trim()) errs.nom = t("editDialog.erreurs.nomRequis");
    if (!editVolume || Number(editVolume) <= 0) errs.volume = t("editDialog.erreurs.volumePositif");
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }

    setEditErrors({});

    try {
      await updateBacMutation.mutateAsync({
        id: editBac!.id,
        dto: {
          nom: editNom.trim(),
          volume: Number(editVolume),
          ...(editNombrePoissons !== "" && { nombrePoissons: Number(editNombrePoissons) }),
          ...(editNombreInitial !== "" && { nombreInitial: Number(editNombreInitial) }),
          ...(editPoidsMoyenInitial !== "" && { poidsMoyenInitial: Number(editPoidsMoyenInitial) }),
          ...(editTypeSysteme !== "" && { typeSysteme: editTypeSysteme }),
        },
      });
      setEditOpen(false);
    } catch {
      // Error already handled by useApi toast
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-base font-semibold">
          {t("list.count", { count: bacs.length })}
        </h2>
        {permissions.includes(Permission.BACS_GERER) && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t("list.nouveau")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createDialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("createDialog.description")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  id="nom"
                  label={t("createDialog.nomLabel")}
                  placeholder={t("createDialog.nomPlaceholder")}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  error={errors.nom}
                />
                <Input
                  id="volume"
                  label={t("createDialog.volumeLabel")}
                  type="number"
                  min="1"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  error={errors.volume}
                />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                    {t("createDialog.annuler")}
                  </Button>
                  <Button type="submit">
                    {t("createDialog.creer")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
        {bacs.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<Container className="h-7 w-7" />}
              title={t("list.empty")}
              description={t("list.emptyDescription")}
            />
          </div>
        ) : (
          bacs.map((bac) => {
            const isOccupe = bac.vagueId !== null;

            if (bac.isBlocked) {
              return (
                <BlockedResourceOverlay key={bac.id} resourceName={bac.nom}>
                  <Card className="opacity-60">
                    <CardContent className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="font-medium">{bac.nom}</p>
                        <p className="text-sm text-muted-foreground">{bac.volume} L</p>
                        {bac.nombrePoissons != null && (
                          <p className="text-sm text-muted-foreground">
                            {t("list.poissons", { count: bac.nombrePoissons })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOccupe ? (
                          <Badge variant="warning">{bac.vagueCode ?? t("list.occupe")}</Badge>
                        ) : (
                          <Badge variant="info">{t("list.libre")}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </BlockedResourceOverlay>
              );
            }

            return (
              <Card key={bac.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{bac.nom}</p>
                    <p className="text-sm text-muted-foreground">{bac.volume} L</p>
                    {bac.nombrePoissons != null && (
                      <p className="text-sm text-muted-foreground">
                        {t("list.poissons", { count: bac.nombrePoissons })}
                      </p>
                    )}
                    {bac.nombreInitial != null && bac.poidsMoyenInitial != null && (
                      <p className="text-xs text-muted-foreground">
                        {t("list.initial", { nombre: bac.nombreInitial, poids: bac.poidsMoyenInitial })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOccupe ? (
                      <Badge variant="warning">
                        {bac.vagueCode ?? t("list.occupe")}
                      </Badge>
                    ) : (
                      <Badge variant="info">{t("list.libre")}</Badge>
                    )}
                    {/* Lien vers la page de détail bac (ADR-043) */}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                      <Link href={`/bacs/${bac.id}`} title="Historique des assignations">
                        <History className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(bac)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditBac(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("editDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4">
            <Input
              id="edit-nom"
              label={t("editDialog.nomLabel")}
              value={editNom}
              onChange={(e) => setEditNom(e.target.value)}
              error={editErrors.nom}
            />
            <Input
              id="edit-volume"
              label={t("editDialog.volumeLabel")}
              type="number"
              min="1"
              value={editVolume}
              onChange={(e) => setEditVolume(e.target.value)}
              error={editErrors.volume}
            />
            <Input
              id="edit-nombrePoissons"
              label={t("editDialog.nombrePoissonsLabel")}
              type="number"
              min="0"
              step="1"
              value={editNombrePoissons}
              onChange={(e) => setEditNombrePoissons(e.target.value)}
              error={editErrors.nombrePoissons}
            />
            <Input
              id="edit-nombreInitial"
              label={t("editDialog.nombreInitialLabel")}
              type="number"
              min="0"
              step="1"
              value={editNombreInitial}
              onChange={(e) => setEditNombreInitial(e.target.value)}
              error={editErrors.nombreInitial}
            />
            <Input
              id="edit-poidsMoyenInitial"
              label={t("editDialog.poidsMoyenInitialLabel")}
              type="number"
              min="0.1"
              step="0.1"
              value={editPoidsMoyenInitial}
              onChange={(e) => setEditPoidsMoyenInitial(e.target.value)}
              error={editErrors.poidsMoyenInitial}
            />
            <Select
              value={editTypeSysteme || "__none__"}
              onValueChange={(val) => setEditTypeSysteme(val === "__none__" ? "" : val)}
            >
              <SelectTrigger label={t("editDialog.typeSystemeLabel")}>
                <SelectValue placeholder={t("editDialog.typeSystemePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("editDialog.typeSystemeNonSpecifie")}</SelectItem>
                {Object.values(TypeSystemeBac).map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`typeSysteme.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                {t("editDialog.annuler")}
              </Button>
              <Button type="submit">
                {t("editDialog.enregistrer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
