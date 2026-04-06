"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronRight, FileText, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ModifierReleveDialog } from "@/components/releves/modifier-releve-dialog";
import { ReleveDetails } from "@/components/releves/releve-details";
import { useReleveService } from "@/services";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/lib/query-keys";
import { TypeReleve, Permission } from "@/types";
import type { Releve } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";

const typeVariants: Record<TypeReleve, "info" | "warning" | "default"> = {
  [TypeReleve.BIOMETRIE]: "info",
  [TypeReleve.MORTALITE]: "warning",
  [TypeReleve.ALIMENTATION]: "default",
  [TypeReleve.QUALITE_EAU]: "info",
  [TypeReleve.COMPTAGE]: "default",
  [TypeReleve.OBSERVATION]: "default",
  [TypeReleve.RENOUVELLEMENT]: "default",
};

const DeleteReleveButton = memo(function DeleteReleveButton({ releveId }: { releveId: string }) {
  const t = useTranslations("releves");
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const releveService = useReleveService();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await releveService.remove(releveId);
      toast({ title: t("list.deleteSuccess"), variant: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setOpen(false);
      router.refresh();
    } catch {
      // toast is handled by the service layer
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("list.deleteTitle")}
          title={t("list.deleteTitle")}
          className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("list.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("list.deleteDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            {t("list.deleteCancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t("list.deleting") : t("list.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

interface RelevesListProps {
  releves: Releve[];
  produits?: ProduitOption[];
  permissions: Permission[];
  limit?: number;
  vagueId?: string;
}

export function RelevesList({ releves, produits = [], permissions, limit, vagueId }: RelevesListProps) {
  const t = useTranslations("releves");
  const [tab, setTab] = useState("tous");

  const isLimited = limit != null;
  const hasMore = isLimited && releves.length > limit;

  // In limited mode, show most recent N (already sorted by date desc from API)
  const displayReleves = useMemo(
    () => (hasMore ? releves.slice(0, limit) : releves),
    [hasMore, releves, limit]
  );

  const filtered = useMemo(
    () => (tab === "tous" ? displayReleves : displayReleves.filter((r) => r.typeReleve === tab)),
    [tab, displayReleves]
  );

  const typeCounts = useMemo(
    () =>
      Object.values(TypeReleve).reduce(
        (acc, tp) => {
          acc[tp] = displayReleves.filter((r) => r.typeReleve === tp).length;
          return acc;
        },
        {} as Record<TypeReleve, number>
      ),
    [displayReleves]
  );

  const releveItems = (items: Releve[]) => (
    <div className="flex flex-col gap-2">
      {items.map((r) => (
        <div key={r.id} id={`releve-${r.id}`}>
          <div className="flex flex-col gap-1 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge variant={typeVariants[r.typeReleve as TypeReleve]}>
                  {t(`types.${r.typeReleve as TypeReleve}`)}
                </Badge>
                {r.bac && (
                  <span className="text-xs text-muted-foreground">{r.bac.nom}</span>
                )}
                {r.modifie && (
                  <Badge variant="warning">{t("list.modified")}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDateTime(r.date)}
                </span>
                <ModifierReleveDialog releve={r} produits={produits} permissions={permissions} />
                {permissions.includes(Permission.RELEVES_SUPPRIMER) && (
                  <DeleteReleveButton releveId={r.id} />
                )}
              </div>
            </div>
            {r.modifie && r.modifications?.[0] && (
              <p className="text-xs italic text-muted-foreground">
                {t("list.modifiedBy", {
                  name: r.modifications[0].user.name,
                  reason: r.modifications[0].raison,
                })}
              </p>
            )}
            <ReleveDetails releve={r} />
            {r.consommations && r.consommations.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                {r.consommations.map((c) => (
                  <span key={c.id} className="text-xs text-muted-foreground">
                    <span className="font-medium">{c.produit.nom}</span>{" "}
                    {c.quantite}{" "}
                    {c.produit.unite.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
            {r.notes && (
              <p className="text-xs italic text-muted-foreground">{r.notes}</p>
            )}
          </div>
          {/* Separator */}
          <div className="border-t border-border" />
        </div>
      ))}
    </div>
  );

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        {t("list.title", { count: releves.length })}
      </h2>
      {isLimited ? (
        // Limited mode: no tabs, just show items + "Voir tout" link
        <>
          {displayReleves.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title={t("list.emptyTitle")}
              description={t("list.emptyDescription")}
            />
          ) : (
            releveItems(displayReleves)
          )}
          {hasMore && vagueId && (
            <Link
              href={`/vagues/${vagueId}/releves`}
              className="mt-2 flex items-center justify-center gap-1 rounded-md border border-border py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
            >
              {t("list.voirTout", { count: releves.length })}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </>
      ) : (
        // Full mode: tabbed UI
        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="w-max">
              <TabsTrigger value="tous">{t("list.tous")}</TabsTrigger>
              {Object.values(TypeReleve).map((tp) =>
                typeCounts[tp] > 0 ? (
                  <TabsTrigger key={tp} value={tp}>
                    {t(`types.${tp}`)} ({typeCounts[tp]})
                  </TabsTrigger>
                ) : null
              )}
            </TabsList>
          </div>
          <TabsContent value={tab}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-7 w-7" />}
                title={t("list.emptyTitle")}
                description={t("list.emptyDescription")}
              />
            ) : (
              releveItems(filtered)
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
