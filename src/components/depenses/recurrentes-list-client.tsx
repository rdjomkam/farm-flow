"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import {
  ArrowLeft,
  Pencil,
  Plus,
  RefreshCw,
  Clock,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
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
import { CategorieDepense, FrequenceRecurrence } from "@/types";
import type { CreateDepenseRecurrenteDTO } from "@/types";
import { useDepenseService } from "@/services";

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

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component principal
// ---------------------------------------------------------------------------

export function RecurrentesListClient({
  templates: initial,
  canManage,
}: Props) {
  const queryClient = useQueryClient();
  const t = useTranslations("depenses");
  const depenseService = useDepenseService();
  const [templates, setTemplates] = useState(initial);

  // Dialog creation
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Partial<CreateDepenseRecurrenteDTO>>({
    frequence: FrequenceRecurrence.MENSUEL,
    jourDuMois: 1,
    isActive: true,
  });

  // Dialog edition
  const [editOpen, setEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreateDepenseRecurrenteDTO>>({});

  // Dialog suppression
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleGenerer() {
    const result = await depenseService.genererDepensesRecurrentes();
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
    }
  }

  async function handleToggleActive(template: TemplateData) {
    const result = await depenseService.updateDepenseRecurrente(template.id, {
      isActive: !template.isActive,
    });
    if (result.ok) {
      setTemplates((prev) =>
        prev.map((tmpl) =>
          tmpl.id === template.id
            ? { ...tmpl, isActive: !tmpl.isActive }
            : tmpl
        )
      );
    }
  }

  async function handleCreate() {
    if (
      !form.description ||
      !form.categorieDepense ||
      !form.montantEstime ||
      !form.frequence
    ) {
      return;
    }
    const result = await depenseService.createDepenseRecurrente(
      form as CreateDepenseRecurrenteDTO
    );
    if (result.ok && result.data) {
      setTemplates((prev) => [
        result.data! as unknown as TemplateData,
        ...prev,
      ]);
      setCreateOpen(false);
      setForm({
        frequence: FrequenceRecurrence.MENSUEL,
        jourDuMois: 1,
        isActive: true,
      });
    }
  }

  function openEdit(template: TemplateData) {
    setEditingTemplate(template);
    setEditForm({
      description: template.description,
      categorieDepense: template.categorieDepense as CategorieDepense,
      montantEstime: template.montantEstime,
      frequence: template.frequence as FrequenceRecurrence,
      jourDuMois: template.jourDuMois,
    });
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editingTemplate) return;
    const result = await depenseService.updateDepenseRecurrente(
      editingTemplate.id,
      editForm
    );
    if (result.ok && result.data) {
      setTemplates((prev) =>
        prev.map((tmpl) =>
          tmpl.id === editingTemplate.id
            ? (result.data! as unknown as TemplateData)
            : tmpl
        )
      );
      setEditOpen(false);
      setEditingTemplate(null);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    const result = await depenseService.deleteDepenseRecurrente(deletingId);
    if (result.ok) {
      setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== deletingId));
      setDeleteOpen(false);
      setDeletingId(null);
    }
  }

  const actifs = templates.filter((tmpl) => tmpl.isActive);
  const inactifs = templates.filter((tmpl) => !tmpl.isActive);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back navigation */}
      <Link
        href="/depenses"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("recurrentes.retour")}
      </Link>

      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleGenerer}
        >
          <RefreshCw className="h-4 w-4" />
          {t("recurrentes.generer")}
        </Button>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                {t("recurrentes.nouveau")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("recurrentes.createTitle")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {t("recurrentes.descriptionLabel")} *
                  </label>
                  <Input
                    value={form.description ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder={t("recurrentes.descriptionPlaceholder")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {t("recurrentes.categorieLabel")} *
                  </label>
                  <Select
                    value={form.categorieDepense}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        categorieDepense: v as CategorieDepense,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("recurrentes.categoriePlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CategorieDepense).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {t(`categories.${cat}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {t("recurrentes.montantLabel")} *
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={form.montantEstime ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        montantEstime: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder={t("recurrentes.montantPlaceholder")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {t("recurrentes.frequenceLabel")} *
                  </label>
                  <Select
                    value={form.frequence}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        frequence: v as FrequenceRecurrence,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FrequenceRecurrence).map((freq) => (
                        <SelectItem key={freq} value={freq}>
                          {t(`recurrentes.frequences.${freq}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {t("recurrentes.jourLabel")}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.jourDuMois ?? 1}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        jourDuMois: Math.min(
                          28,
                          Math.max(1, parseInt(e.target.value) || 1)
                        ),
                      }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">
                    {t("recurrentes.annuler")}
                  </Button>
                </DialogClose>
                <Button onClick={handleCreate}>
                  {t("recurrentes.creer")}
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
            {t("recurrentes.tabActifs", { count: actifs.length })}
          </h2>
          <div className="flex flex-col gap-3">
            {actifs.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                canManage={canManage}
                onToggle={handleToggleActive}
                onEdit={openEdit}
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
            {t("recurrentes.tabInactifs", { count: inactifs.length })}
          </h2>
          <div className="flex flex-col gap-3">
            {inactifs.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                canManage={canManage}
                onToggle={handleToggleActive}
                onEdit={openEdit}
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
          <p className="text-sm">{t("recurrentes.empty")}</p>
          {canManage && (
            <p className="text-xs">{t("recurrentes.emptyAction")}</p>
          )}
        </div>
      )}

      {/* Dialog edition */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recurrentes.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t("recurrentes.descriptionLabel")} *
              </label>
              <Input
                value={editForm.description ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder={t("recurrentes.descriptionPlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t("recurrentes.categorieLabel")} *
              </label>
              <Select
                value={editForm.categorieDepense as string | undefined}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    categorieDepense: v as CategorieDepense,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("recurrentes.categoriePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CategorieDepense).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`categories.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t("recurrentes.montantLabel")} *
              </label>
              <Input
                type="number"
                min={1}
                value={editForm.montantEstime ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    montantEstime: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder={t("placeholderExample", { value: "150000" })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t("recurrentes.frequenceLabel")} *
              </label>
              <Select
                value={editForm.frequence as string | undefined}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    frequence: v as FrequenceRecurrence,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(FrequenceRecurrence).map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {t(`recurrentes.frequences.${freq}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t("recurrentes.jourLabel")}
              </label>
              <Input
                type="number"
                min={1}
                max={28}
                value={editForm.jourDuMois ?? 1}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    jourDuMois: Math.min(
                      28,
                      Math.max(1, parseInt(e.target.value) || 1)
                    ),
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                {t("recurrentes.annuler")}
              </Button>
            </DialogClose>
            <Button onClick={handleEdit}>
              {t("recurrentes.enregistrer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recurrentes.supprimerTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("recurrentes.supprimerDescription")}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setDeletingId(null);
                }}
              >
                {t("recurrentes.annuler")}
              </Button>
            </DialogClose>
            <Button variant="danger" onClick={handleDelete}>
              {t("recurrentes.supprimer")}
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
  onEdit,
  onDelete,
}: {
  template: TemplateData;
  canManage: boolean;
  onToggle: (t: TemplateData) => void;
  onEdit: (t: TemplateData) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("depenses");
  const locale = useLocale();
  const frequence = template.frequence as FrequenceRecurrence;
  const categorie = template.categorieDepense as CategorieDepense;

  return (
    <Card className={template.isActive ? "" : "opacity-60"}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">
              {template.description}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(`categories.${categorie}`)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={template.isActive ? "en_cours" : "default"}>
              {template.isActive
                ? t("recurrentes.badgeActif")
                : t("recurrentes.badgeInactif")}
            </Badge>
            <Badge variant="info" className="text-xs">
              {t(`recurrentes.frequences.${frequence}`)}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground text-xs">
              {t("recurrentes.montantEstime")}{" "}
            </span>
            <span className="font-semibold">
              {new Intl.NumberFormat(locale).format(
                Math.round(template.montantEstime)
              )}{" "}
              FCFA
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("recurrentes.jourDuMois", { jour: template.jourDuMois })}
          </div>
        </div>

        {template.derniereGeneration && (
          <p className="text-xs text-muted-foreground">
            {t("recurrentes.derniereGeneration")}{" "}
            {formatDate(template.derniereGeneration, locale)}
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
                  {t("recurrentes.desactiver")}
                </>
              ) : (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  {t("recurrentes.activer")}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onEdit(template)}
            >
              <Pencil className="h-4 w-4" />
              {t("recurrentes.modifier")}
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
