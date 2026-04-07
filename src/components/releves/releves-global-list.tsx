"use client";

import { memo } from "react";
import { Calendar, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ModifierReleveDialog } from "@/components/releves/modifier-releve-dialog";
import { ReleveDetails } from "@/components/releves/releve-details";
import { TypeReleve, Permission } from "@/types";
import type { Releve } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";
import { DeleteReleveButtonGlobal } from "@/components/releves/delete-releve-button-global";

const typeVariants: Record<TypeReleve, "info" | "warning" | "default"> = {
  [TypeReleve.BIOMETRIE]: "info",
  [TypeReleve.MORTALITE]: "warning",
  [TypeReleve.ALIMENTATION]: "default",
  [TypeReleve.QUALITE_EAU]: "info",
  [TypeReleve.COMPTAGE]: "default",
  [TypeReleve.OBSERVATION]: "default",
  [TypeReleve.RENOUVELLEMENT]: "default",
  [TypeReleve.TRI]: "default",
};

interface Props {
  releves: Releve[];
  total: number;
  offset: number;
  limit: number;
  permissions: Permission[];
  produits: ProduitOption[];
}

const ReleveCard = memo(function ReleveCard({
  releve,
  produits,
  permissions,
}: {
  releve: Releve;
  produits: ProduitOption[];
  permissions: Permission[];
}) {
  const t = useTranslations("releves");
  const type = releve.typeReleve as TypeReleve;

  return (
    <div id={`releve-${releve.id}`}>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={typeVariants[type]}>
              {t(`types.${type}`)}
            </Badge>
            {releve.bac && (
              <span className="text-xs text-muted-foreground">{releve.bac.nom}</span>
            )}
            {releve.modifie && (
              <Badge variant="warning">{t("list.modified")}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDateTime(releve.date)}
            </span>
            <ModifierReleveDialog
              releve={releve}
              produits={produits}
              permissions={permissions}
            />
            {permissions.includes(Permission.RELEVES_SUPPRIMER) && (
              <DeleteReleveButtonGlobal releveId={releve.id} />
            )}
          </div>
        </div>
        {releve.modifie && releve.modifications?.[0] && (
          <p className="text-xs italic text-muted-foreground">
            {t("list.modifiedBy", {
              name: releve.modifications[0].user.name,
              reason: releve.modifications[0].raison,
            })}
          </p>
        )}
        <ReleveDetails releve={releve} />
        {releve.consommations && releve.consommations.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
            {releve.consommations.map((c) => (
              <span key={c.id} className="text-xs text-muted-foreground">
                <span className="font-medium">{c.produit.nom}</span>{" "}
                {c.quantite} {c.produit.unite.toLowerCase()}
              </span>
            ))}
          </div>
        )}
        {releve.notes && (
          <p className="text-xs italic text-muted-foreground">{releve.notes}</p>
        )}
      </div>
      <div className="border-t border-border" />
    </div>
  );
});

export function RelevesGlobalList({
  releves,
  total,
  offset,
  limit,
  permissions,
  produits,
}: Props) {
  const t = useTranslations("releves");

  if (releves.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title={t("list.emptyTitle")}
        description={t("list.emptyDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <ul role="list" className="flex flex-col">
        {releves.map((r) => (
          <li key={r.id}>
            <ReleveCard releve={r} produits={produits} permissions={permissions} />
          </li>
        ))}
      </ul>
    </div>
  );
}
