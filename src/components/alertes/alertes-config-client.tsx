"use client";

import { useState } from "react";
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

// Labels et icones par type d'alerte
const typeAlerteConfig: Record<
  TypeAlerte,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    hasSeuilValeur: boolean;
    hasSeuilPourcentage: boolean;
    labelSeuilValeur?: string;
    labelSeuilPourcentage?: string;
  }
> = {
  [TypeAlerte.MORTALITE_ELEVEE]: {
    label: "Mortalite elevee",
    description: "Alerte quand le taux de mortalite depasse le seuil defini",
    icon: AlertTriangle,
    color: "text-danger",
    hasSeuilValeur: false,
    hasSeuilPourcentage: true,
    labelSeuilPourcentage: "Seuil de mortalite (%)",
  },
  [TypeAlerte.QUALITE_EAU]: {
    label: "Qualite de l'eau",
    description: "Alerte quand les parametres qualite eau sont hors normes",
    icon: Droplets,
    color: "text-accent-blue",
    hasSeuilValeur: false,
    hasSeuilPourcentage: false,
  },
  [TypeAlerte.STOCK_BAS]: {
    label: "Stock bas",
    description: "Alerte quand le stock d'un produit passe sous le seuil d'alerte",
    icon: Package,
    color: "text-warning",
    hasSeuilValeur: false,
    hasSeuilPourcentage: false,
  },
  [TypeAlerte.RAPPEL_ALIMENTATION]: {
    label: "Rappel alimentation",
    description: "Rappel quand aucun releve alimentation n'a ete fait depuis N jours",
    icon: Clock,
    color: "text-primary",
    hasSeuilValeur: true,
    hasSeuilPourcentage: false,
    labelSeuilValeur: "Delai sans releve (jours)",
  },
  [TypeAlerte.RAPPEL_BIOMETRIE]: {
    label: "Rappel biometrie",
    description: "Rappel quand aucune biometrie n'a ete faite depuis N jours",
    icon: Activity,
    color: "text-accent-purple",
    hasSeuilValeur: true,
    hasSeuilPourcentage: false,
    labelSeuilValeur: "Delai sans biometrie (jours)",
  },
  [TypeAlerte.PERSONNALISEE]: {
    label: "Personnalisee",
    description: "Alerte personnalisee avec un seuil defini manuellement",
    icon: Star,
    color: "text-muted-foreground",
    hasSeuilValeur: true,
    hasSeuilPourcentage: true,
    labelSeuilValeur: "Seuil de valeur",
    labelSeuilPourcentage: "Seuil en pourcentage (%)",
  },
  [TypeAlerte.BESOIN_EN_RETARD]: {
    label: "Besoin en retard",
    description: "Alerte quand une liste de besoins depasse sa date limite sans etre traitee",
    icon: CalendarClock,
    color: "text-danger",
    hasSeuilValeur: false,
    hasSeuilPourcentage: false,
  },
  [TypeAlerte.DENSITE_ELEVEE]: {
    label: "Densite elevee",
    description: "Alerte quand la biomasse par m3 depasse le seuil pour le type de systeme",
    icon: Waves,
    color: "text-warning",
    hasSeuilValeur: true,
    hasSeuilPourcentage: false,
    labelSeuilValeur: "Seuil de densite (kg/m3)",
  },
  [TypeAlerte.RENOUVELLEMENT_EAU_INSUFFISANT]: {
    label: "Renouvellement eau insuffisant",
    description: "Alerte quand le taux de renouvellement effectif est insuffisant pour la densite actuelle",
    icon: RefreshCw,
    color: "text-accent-blue",
    hasSeuilValeur: true,
    hasSeuilPourcentage: false,
    labelSeuilValeur: "Taux minimum (%/jour)",
  },
  [TypeAlerte.AUCUN_RELEVE_QUALITE_EAU]: {
    label: "Absence releve qualite eau",
    description: "Alerte quand aucun releve qualite eau n'a ete enregistre depuis N jours a densite elevee",
    icon: Eye,
    color: "text-warning",
    hasSeuilValeur: true,
    hasSeuilPourcentage: false,
    labelSeuilValeur: "Delai sans releve (jours)",
  },
  [TypeAlerte.DENSITE_CRITIQUE_QUALITE_EAU]: {
    label: "Densite critique + qualite eau degradee",
    description: "Alerte combinee : densite elevee ET qualite eau critique simultanement",
    icon: Zap,
    color: "text-danger",
    hasSeuilValeur: false,
    hasSeuilPourcentage: false,
  },
  [TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT]: {
    label: "Rappel renouvellement abonnement",
    description: "Rappel automatique quand l'abonnement expire dans 14, 7, 3 ou 1 jour(s)",
    icon: Bell,
    color: "text-primary",
    hasSeuilValeur: false,
    hasSeuilPourcentage: false,
  },
  // Sprint 49 — Fin d'essai
  [TypeAlerte.ABONNEMENT_ESSAI_EXPIRE]: {
    label: "Essai gratuit expire",
    description: "Notification envoyee quand un essai gratuit arrive a expiration",
    icon: Bell,
    color: "text-warning",
    hasSeuilValeur: false,
    hasSeuilPourcentage: false,
  },
};

interface AlerteConfigItem {
  typeAlerte: TypeAlerte;
  config: ConfigAlerte | null;
}

interface AlertesConfigClientProps {
  configs: ConfigAlerte[];
}

export function AlertesConfigClient({ configs }: AlertesConfigClientProps) {
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
          Verifier maintenant
        </Button>
      </div>

      {/* Liste des types d'alertes */}
      {allTypes.map((typeAlerte) => {
        const config = typeAlerteConfig[typeAlerte];
        const Icon = config.icon;
        const enabled = enabledMap[typeAlerte];

        return (
          <Card key={typeAlerte} className={enabled ? "border-primary/30" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{config.label}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
                  </div>
                </div>
                {/* Toggle switch */}
                <button
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? "Desactiver" : "Activer"} l'alerte ${config.label}`}
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
                    label={config.labelSeuilValeur ?? "Seuil de valeur"}
                    min={0}
                    value={seuilValeurMap[typeAlerte]}
                    onChange={(e) =>
                      setSeuilValeurMap((prev) => ({ ...prev, [typeAlerte]: e.target.value }))
                    }
                    placeholder="Ex: 3"
                  />
                )}
                {config.hasSeuilPourcentage && (
                  <Input
                    type="number"
                    label={config.labelSeuilPourcentage ?? "Seuil en pourcentage (%)"}
                    min={0}
                    max={100}
                    value={seuilPourcentageMap[typeAlerte]}
                    onChange={(e) =>
                      setSeuilPourcentageMap((prev) => ({ ...prev, [typeAlerte]: e.target.value }))
                    }
                    placeholder="Ex: 5"
                  />
                )}
                <Button
                  size="sm"
                  onClick={() => saveConfig(typeAlerte)}
                  className="gap-2 self-end"
                >
                  <Save className="h-4 w-4" />
                  Sauvegarder
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
                  Sauvegarder
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
