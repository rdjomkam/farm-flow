"use client";

/**
 * ExonerationsList — liste des exonérations actives (backoffice).
 *
 * Affiche les exonérations en cartes empilées (mobile-first 360px).
 * Chaque carte montre : utilisateur, site, motif, dates, statut.
 * Bouton "Annuler" ouvre un Dialog de confirmation (R5 : DialogTrigger asChild).
 *
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 * R2 : enums importés depuis @/types pour les comparaisons de statut
 *
 * Story 51.2 — Sprint 51
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldOff, User, Building2, Calendar, AlertCircle } from "lucide-react";
import { StatutAbonnement } from "@/types";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExonerationUser {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
}

interface ExonerationSite {
  id: string;
  name: string;
}

interface ExonerationPlan {
  id: string;
  nom: string;
  typePlan: string;
}

export interface ExonerationItem {
  id: string;
  userId: string;
  siteId: string | null;
  statut: string;
  dateDebut: string | Date;
  dateFin: string | Date;
  motifExoneration: string | null;
  user: ExonerationUser;
  site: ExonerationSite | null;
  plan: ExonerationPlan;
}

// ---------------------------------------------------------------------------
// Statut badge
// ---------------------------------------------------------------------------

function StatutBadge({ statut }: { statut: string }) {
  const isActif = (statut as string) === StatutAbonnement.ACTIF;
  const isAnnule = (statut as string) === StatutAbonnement.ANNULE;

  if (isActif) {
    return (
      <span className="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
        ACTIF
      </span>
    );
  }
  if (isAnnule) {
    return (
      <span className="inline-flex items-center rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
        ANNULE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      {statut}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Cancel confirmation dialog
// ---------------------------------------------------------------------------

interface CancelDialogProps {
  exonerationId: string;
  userName: string;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

function CancelExonerationDialog({ exonerationId, userName, trigger, onSuccess }: CancelDialogProps) {
  const t = useTranslations("backoffice.exonerations.cancelDialog");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/backoffice/exonerations/${exonerationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? t("errorDefault"));
      }
      toast({ title: t("successTitle"), description: t("successDesc") });
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: t("errorTitle"),
        description: err instanceof Error ? err.message : t("errorDefault"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* R5 — DialogTrigger asChild */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">
            Utilisateur : <strong>{userName}</strong>
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? t("cancelling") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Exoneration card (mobile)
// ---------------------------------------------------------------------------

const DATE_PERMANENTE_YEAR = 2099;

function isPermanent(dateFin: string | Date): boolean {
  return new Date(dateFin).getFullYear() >= DATE_PERMANENTE_YEAR;
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ExonerationCard({
  item,
  onRefresh,
}: {
  item: ExonerationItem;
  onRefresh: () => void;
}) {
  const t = useTranslations("backoffice.exonerations.card");
  const isActif = (item.statut as string) === StatutAbonnement.ACTIF;
  const permanent = isPermanent(item.dateFin);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header : statut + user */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="truncate font-semibold text-foreground">
              {item.user.name}
            </p>
          </div>
          {item.user.email && (
            <p className="text-xs text-muted-foreground truncate pl-6">
              {item.user.email}
            </p>
          )}
        </div>
        <StatutBadge statut={item.statut} />
      </div>

      {/* Site */}
      {item.site && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.site.name}</span>
        </div>
      )}

      {/* Motif */}
      {item.motifExoneration && (
        <div className="rounded-lg bg-muted p-3 text-sm text-foreground">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("motif")} :
          </span>
          <p className="mt-1">{item.motifExoneration}</p>
        </div>
      )}

      {/* Dates */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {t("dateDebut")} {formatDate(item.dateDebut)}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {permanent ? t("permanent") : `${t("dateFin")} ${formatDate(item.dateFin)}`}
        </span>
      </div>

      {/* Action — annuler */}
      {isActif && (
        <div className="pt-1">
          <CancelExonerationDialog
            exonerationId={item.id}
            userName={item.user.name}
            onSuccess={onRefresh}
            trigger={
              <Button variant="outline" size="sm" className="w-full text-danger border-danger/40 hover:bg-danger/5">
                {t("annuler")}
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

function ExonerationTableRow({
  item,
  onRefresh,
}: {
  item: ExonerationItem;
  onRefresh: () => void;
}) {
  const t = useTranslations("backoffice.exonerations.card");
  const isActif = (item.statut as string) === StatutAbonnement.ACTIF;
  const permanent = isPermanent(item.dateFin);

  return (
    <tr className="border-b border-border hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-foreground">{item.user.name}</p>
          {item.user.email && (
            <p className="text-xs text-muted-foreground">{item.user.email}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.site?.name ?? "-"}</td>
      <td className="px-4 py-3 text-sm text-foreground max-w-xs">
        <p className="truncate" title={item.motifExoneration ?? ""}>
          {item.motifExoneration ?? <span className="text-muted-foreground italic">-</span>}
        </p>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDate(item.dateDebut)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {permanent ? (
          <span className="text-muted-foreground italic">{t("permanent")}</span>
        ) : (
          formatDate(item.dateFin)
        )}
      </td>
      <td className="px-4 py-3">
        <StatutBadge statut={item.statut} />
      </td>
      <td className="px-4 py-3">
        {isActif && (
          <CancelExonerationDialog
            exonerationId={item.id}
            userName={item.user.name}
            onSuccess={onRefresh}
            trigger={
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
                {t("annuler")}
              </Button>
            }
          />
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ExonerationsListProps {
  initialItems: ExonerationItem[];
}

export function ExonerationsList({ initialItems }: ExonerationsListProps) {
  const t = useTranslations("backoffice.exonerations");
  const [items, setItems] = useState(initialItems);
  const [refreshKey, setRefreshKey] = useState(0);

  async function refetch() {
    try {
      const res = await fetch("/api/backoffice/exonerations");
      if (res.ok) {
        const json = await res.json();
        setItems(json.exonerations ?? []);
      }
    } catch {
      // silencieux
    }
    setRefreshKey((k) => k + 1);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
        <ShieldOff className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">{t("empty")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("emptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" key={refreshKey}>
      {/* Mobile — cartes empilées */}
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <ExonerationCard key={item.id} item={item} onRefresh={refetch} />
        ))}
      </div>

      {/* Desktop — table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("card.user")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("card.site")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("card.motif")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("card.dateDebut")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("card.dateFin")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("card.statut")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {items.map((item) => (
              <ExonerationTableRow key={item.id} item={item} onRefresh={refetch} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
