"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings, Star, Copy, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfigService } from "@/services";
import type { ConfigElevage } from "@/types";

interface Props {
  configs: ConfigElevage[];
}

export function ConfigElevageListClient({ configs: initialConfigs }: Props) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const configService = useConfigService();

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le profil "${nom}" ?`)) return;
    setDeletingId(id);
    const result = await configService.deleteConfig(id);
    if (result.ok) {
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    }
    setDeletingId(null);
  };

  const handleDupliquer = async (id: string, nom: string) => {
    const nouveauNom = prompt(`Nom du profil duplique :`, `${nom} (copie)`);
    if (!nouveauNom) return;
    const result = await configService.dupliquerConfig(id, { nom: nouveauNom });
    if (result.ok && result.data) {
      setConfigs((prev) => [...prev, result.data as ConfigElevage]);
    }
  };

  if (configs.length === 0) {
    return (
      <div className="text-center py-12">
        <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">Aucun profil de configuration.</p>
        <Link href="/settings/config-elevage/nouveau">
          <Button>Creer un profil</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {configs.map((config) => (
        <div
          key={config.id}
          className="border border-border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
        >
          {/* Header de la carte */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {config.isDefault && (
                <Star className="h-4 w-4 text-accent-amber shrink-0" fill="currentColor" />
              )}
              <h3 className="font-medium text-sm truncate">{config.nom}</h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {config.isDefault && (
                <Badge variant="warning" className="text-xs">Par defaut</Badge>
              )}
              {!config.isActive && (
                <Badge variant="default" className="text-xs">Inactif</Badge>
              )}
            </div>
          </div>

          {/* Description */}
          {config.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {config.description}
            </p>
          )}

          {/* KPIs rapides */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Objectif</p>
              <p className="text-sm font-semibold">{config.poidsObjectif}g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Duree</p>
              <p className="text-sm font-semibold">{config.dureeEstimeeCycle}j</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Survie cible</p>
              <p className="text-sm font-semibold">{config.tauxSurvieObjectif}%</p>
            </div>
          </div>

          {/* Benchmarks FCR/SGR */}
          <div className="flex gap-3 mb-3 text-xs text-muted-foreground">
            <span>FCR : <span className="text-accent-green font-medium">&lt;{config.fcrExcellentMax}</span> excellent</span>
            <span>SGR : <span className="text-accent-green font-medium">&gt;{config.sgrExcellentMin}%/j</span> excellent</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Link href={`/settings/config-elevage/${config.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <ChevronRight className="h-3 w-3 mr-1" />
                Modifier
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => handleDupliquer(config.id, config.nom)}
            >
              <Copy className="h-3 w-3" />
            </Button>
            {!config.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-danger hover:text-danger"
                onClick={() => handleDelete(config.id, config.nom)}
                disabled={deletingId === config.id}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
