"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { StatutActivation } from "@/types";

const STATUT_LABEL_KEYS: Record<StatutActivation, `statutsActivation.${string}`> = {
  [StatutActivation.ACTIVE]: "statutsActivation.ACTIVE",
  [StatutActivation.EXPIREE]: "statutsActivation.EXPIREE",
  [StatutActivation.SUSPENDUE]: "statutsActivation.SUSPENDUE",
};

const statutVariants: Record<StatutActivation, "en_cours" | "default" | "warning"> = {
  [StatutActivation.ACTIVE]: "en_cours",
  [StatutActivation.EXPIREE]: "default",
  [StatutActivation.SUSPENDUE]: "warning",
};

interface ActivationData {
  id: string;
  code: string;
  statut: string;
  dateActivation: string;
  dateExpiration: string | null;
  notes: string | null;
  pack: { id: string; nom: string; nombreAlevins: number };
  clientSite: { id: string; name: string };
  user: { id: string; name: string };
}

interface Props {
  activations: ActivationData[];
}

export function ActivationsListClient({ activations }: Props) {
  const t = useTranslations("packs");
  const [tab, setTab] = useState("actives");
  const [search, setSearch] = useState("");

  const filtered = activations.filter((a) => {
    const matchTab =
      tab === "toutes" ? true :
      tab === "actives" ? a.statut === StatutActivation.ACTIVE :
      tab === "expirees" ? a.statut === StatutActivation.EXPIREE :
      a.statut === StatutActivation.SUSPENDUE;

    const matchSearch =
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.clientSite.name.toLowerCase().includes(search.toLowerCase()) ||
      a.pack.nom.toLowerCase().includes(search.toLowerCase());

    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("activationsSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="actives">{t("activationsTabs.actives")}</TabsTrigger>
          <TabsTrigger value="expirees">{t("activationsTabs.expirees")}</TabsTrigger>
          <TabsTrigger value="toutes">{t("activationsTabs.toutes")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
              title={t("emptyState.noActivations")}
              description={search ? t("emptyState.noSearchResults") : t("emptyState.noActivationsFiltered")}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((act) => (
                <Card key={act.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm">{act.code}</span>
                          <Badge variant={statutVariants[act.statut as StatutActivation]}>
                            {t(STATUT_LABEL_KEYS[act.statut as StatutActivation])}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm mt-1">{act.clientSite.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span>Pack : <Link href={`/packs/${act.pack.id}`} className="hover:underline">{act.pack.nom}</Link></span>
                          <span>{formatNumber(act.pack.nombreAlevins)} alevins</span>
                          <span>{t("activations.activeLe")} {new Date(act.dateActivation).toLocaleDateString("fr-FR")}</span>
                          {act.dateExpiration && (
                            <span>{t("activations.expireLe")} {new Date(act.dateExpiration).toLocaleDateString("fr-FR")}</span>
                          )}
                        </div>
                        {act.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{act.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
