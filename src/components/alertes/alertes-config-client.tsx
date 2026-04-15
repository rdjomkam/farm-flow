"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  AlertTriangle,
  Droplets,
  Package,
  Clock,
  Activity,
  Star,
  RefreshCw,
  Save,
  CalendarClock,
  Waves,
  Eye,
  Zap,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfigService } from "@/services";
import { TypeAlerte } from "@/types";
import type { ConfigAlerte } from "@/types";

// Icon and style config per alert type (labels come from translations)
const typeAlerteConfig: Record<
  TypeAlerte,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    hasSeuilValeur: boolean;
    hasSeuilPourcentage: boolean;
  }
> = {
  [TypeAlerte.MORTALITE_ELEVEE]: { icon: AlertTriangle, color: "text-danger", hasSeuilValeur: false, hasSeuilPourcentage: true },
  [TypeAlerte.QUALITE_EAU]: { icon: Droplets, color: "text-accent-blue", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.STOCK_BAS]: { icon: Package, color: "text-warning", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.RAPPEL_ALIMENTATION]: { icon: Clock, color: "text-primary", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.RAPPEL_BIOMETRIE]: { icon: Activity, color: "text-accent-purple", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.PERSONNALISEE]: { icon: Star, color: "text-muted-foreground", hasSeuilValeur: true, hasSeuilPourcentage: true },
  [TypeAlerte.BESOIN_EN_RETARD]: { icon: CalendarClock, color: "text-danger", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.DENSITE_ELEVEE]: { icon: Waves, color: "text-warning", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.RENOUVELLEMENT_EAU_INSUFFISANT]: { icon: RefreshCw, color: "text-accent-blue", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.AUCUN_RELEVE_QUALITE_EAU]: { icon: Eye, color: "text-warning", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.DENSITE_CRITIQUE_QUALITE_EAU]: { icon: Zap, color: "text-danger", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT]: { icon: Bell, color: "text-primary", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.ABONNEMENT_ESSAI_EXPIRE]: { icon: Bell, color: "text-warning", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.MALES_STOCK_BAS]: { icon: AlertTriangle, color: "text-warning", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.FEMELLE_SUREXPLOITEE]: { icon: AlertTriangle, color: "text-danger", hasSeuilValeur: true, hasSeuilPourcentage: false },
  [TypeAlerte.CONSANGUINITE_RISQUE]: { icon: Activity, color: "text-accent-purple", hasSeuilValeur: false, hasSeuilPourcentage: true },
  [TypeAlerte.INCUBATION_ECLOSION]: { icon: Clock, color: "text-accent-blue", hasSeuilValeur: false, hasSeuilPourcentage: false },
  [TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT]: { icon: AlertTriangle, color: "text-danger", hasSeuilValeur: false, hasSeuilPourcentage: true },
};

interface AlerteConfigItem {
  typeAlerte: TypeAlerte;
  config: ConfigAlerte | null;
}

interface AlertesConfigClientProps {
  configs: ConfigAlerte[];
}

export function AlertesConfigClient({ configs }: AlertesConfigClientProps) {
  const t = useTranslations("alertes.config");
  const queryClient = useQueryClient();
  const configService = useConfigService();

  // Construire la liste de tous les types avec leur config existante
  const allTypes = Object.values(TypeAlerte);
  const [items, setItems] = useState<AlerteConfigItem[]>(
    allTypes.map((typeAlerte) => ({
      typeAlerte,
      config: configs.find((c) => c.typeAlerte === typeAlerte) ?? null,
    }))
  );

  // Etats locaux pour les toggles et seuils
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(
    Object.fromEntries(
      allTypes.map((t) => [
        t,
        items.find((i) => i.typeAlerte === t)?.config?.enabled ?? false,
      ])
    )
  );
  const [seuilValeurMap, setSeuilValeurMap] = useState<Record<string, string>>(
    Object.fromEntries(
      allTypes.map((t) => [
        t,
        String(items.find((i) => i.typeAlerte === t)?.config?.seuilValeur ?? ""),
      ])
    )
  );
  const [seuilPourcentageMap, setSeuilPourcentageMap] = useState<Record<string, string>>(
    Object.fromEntries(
      allTypes.map((t) => [
        t,
        String(items.find((i) => i.typeAlerte === t)?.config?.seuilPourcentage ?? ""),
      ])
    )
  );

  async function saveConfig(typeAlerte: TypeAlerte) {
    const enabled = enabledMap[typeAlerte];
    const seuilValeurRaw = seuilValeurMap[typeAlerte];
    const seuilPourcentageRaw = seuilPourcentageMap[typeAlerte];

    const seuilValeur = seuilValeurRaw !== "" ? Number(seuilValeurRaw) : undefined;
    const seuilPourcentage = seuilPourcentageRaw !== "" ? Number(seuilPourcentageRaw) : undefined;

    const item = items.find((i) => i.typeAlerte === typeAlerte);
    const existingId = item?.config?.id;

    let result;
    if (existingId) {
      result = await configService.updateConfigAlerte(existingId, { enabled, seuilValeur, seuilPourcentage });
    } else {
      result = await configService.createConfigAlerte({ typeAlerte, enabled, seuilValeur, seuilPourcentage });
    }

    if (result.ok && result.data) {
      const savedConfig = result.data as ConfigAlerte;
      setItems((prev) =>
        prev.map((i) =>
          i.typeAlerte === typeAlerte ? { ...i, config: savedConfig } : i
        )
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
  }

  async function checkAlertes() {
    const result = await configService.checkAlertes();
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bouton verifier maintenant */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={checkAlertes}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t("verifierMaintenant")}
        </Button>
      </div>

      {/* Liste des types d'alertes */}
      {allTypes.map((typeAlerte) => {
        const config = typeAlerteConfig[typeAlerte];
        const Icon = config.icon;
        const enabled = enabledMap[typeAlerte];
        const typeKey = `types.${typeAlerte}` as const;
        const label = t(`${typeKey}.label` as Parameters<typeof t>[0]);

        return (
          <Card key={typeAlerte} className={enabled ? "border-primary/30" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{label}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{t(`${typeKey}.description` as Parameters<typeof t>[0])}</p>
                  </div>
                </div>
                {/* Toggle switch */}
                <button
                  role="switch"
                  aria-checked={enabled}
                  aria-label={t("ariaToggle", { action: enabled ? t("desactiver") : t("activer"), label })}
                  onClick={() =>
                    setEnabledMap((prev) => ({ ...prev, [typeAlerte]: !prev[typeAlerte] }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    enabled ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      enabled ? "translate-x-[22px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </div>
            </CardHeader>

            {enabled && (config.hasSeuilValeur || config.hasSeuilPourcentage) && (
              <CardContent className="flex flex-col gap-3">
                {config.hasSeuilValeur && (
                  <Input
                    type="number"
                    label={t.has(`${typeKey}.seuilValeur` as Parameters<typeof t>[0]) ? t(`${typeKey}.seuilValeur` as Parameters<typeof t>[0]) : t("seuilValeurDefaut")}
                    min={0}
                    value={seuilValeurMap[typeAlerte]}
                    onChange={(e) =>
                      setSeuilValeurMap((prev) => ({ ...prev, [typeAlerte]: e.target.value }))
                    }
                    placeholder={t("placeholderSeuilValeur")}
                  />
                )}
                {config.hasSeuilPourcentage && (
                  <Input
                    type="number"
                    label={t.has(`${typeKey}.seuilPourcentage` as Parameters<typeof t>[0]) ? t(`${typeKey}.seuilPourcentage` as Parameters<typeof t>[0]) : t("seuilPourcentageDefaut")}
                    min={0}
                    max={100}
                    value={seuilPourcentageMap[typeAlerte]}
                    onChange={(e) =>
                      setSeuilPourcentageMap((prev) => ({ ...prev, [typeAlerte]: e.target.value }))
                    }
                    placeholder={t("placeholderSeuilPourcentage")}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() => saveConfig(typeAlerte)}
                  className="gap-2 self-end"
                >
                  <Save className="h-4 w-4" />
                  {t("sauvegarder")}
                </Button>
              </CardContent>
            )}

            {enabled && !config.hasSeuilValeur && !config.hasSeuilPourcentage && (
              <CardContent>
                <Button
                  size="sm"
                  onClick={() => saveConfig(typeAlerte)}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {t("sauvegarder")}
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
