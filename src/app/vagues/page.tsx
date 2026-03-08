import { Header } from "@/components/layout/header";
import { VaguesListClient } from "@/components/vagues/vagues-list-client";
import { getVagues } from "@/lib/queries/vagues";
import { getBacsLibres } from "@/lib/queries/bacs";
import { StatutVague } from "@/types";
import type { VagueSummaryResponse, BacResponse } from "@/types";

export default async function VaguesPage() {
  const [vaguesRaw, bacsLibresRaw] = await Promise.all([
    getVagues(),
    getBacsLibres(),
  ]);

  const vagues: VagueSummaryResponse[] = vaguesRaw.map((v) => {
    const now = v.dateFin ?? new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: v.id,
      code: v.code,
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
      statut: v.statut as StatutVague,
      nombreInitial: v.nombreInitial,
      poidsMoyenInitial: v.poidsMoyenInitial,
      origineAlevins: v.origineAlevins,
      nombreBacs: v._count.bacs,
      joursEcoules,
      createdAt: v.createdAt,
    };
  });

  const bacsLibres: BacResponse[] = bacsLibresRaw.map((b) => ({
    id: b.id,
    nom: b.nom,
    volume: b.volume,
    nombrePoissons: b.nombrePoissons,
    vagueId: b.vagueId,
    vagueCode: null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return (
    <>
      <Header title="Vagues" />
      <VaguesListClient vagues={vagues} bacsLibres={bacsLibres} />
    </>
  );
}
