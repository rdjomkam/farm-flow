import { prisma } from "@/lib/db";
import { TypeReleve } from "@/types";
import type { IndicateursVague } from "@/types";
import {
  calculerTauxSurvie,
  calculerGainPoids,
  calculerSGR,
  calculerFCR,
  calculerBiomasse,
} from "@/lib/calculs";

/**
 * Agrege les donnees d'une vague pour calculer ses indicateurs.
 * Verifie que la vague appartient au site.
 */
export async function getIndicateursVague(
  siteId: string,
  vagueId: string
): Promise<IndicateursVague | null> {
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId },
    include: {
      releves: {
        orderBy: { date: "asc" },
        select: {
          typeReleve: true,
          date: true,
          poidsMoyen: true,
          tailleMoyenne: true,
          nombreMorts: true,
          quantiteAliment: true,
          nombreCompte: true,
        },
      },
    },
  });

  if (!vague) return null;

  // Separer les releves par type
  const biometries = vague.releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
  const mortalites = vague.releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
  const alimentations = vague.releves.filter(
    (r) => r.typeReleve === TypeReleve.ALIMENTATION
  );
  const comptages = vague.releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

  // Derniere biometrie
  const derniereBiometrie = biometries.at(-1);
  const poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;
  const tailleMoyenne = derniereBiometrie?.tailleMoyenne ?? null;

  // Total mortalites
  const totalMortalites = mortalites.reduce(
    (sum, r) => sum + (r.nombreMorts ?? 0),
    0
  );

  // Total aliment
  const totalAliment = alimentations.reduce(
    (sum, r) => sum + (r.quantiteAliment ?? 0),
    0
  );

  // Nombre vivants : dernier comptage ou (initial - mortalites)
  const dernierComptage = comptages.at(-1);
  const nombreVivants =
    dernierComptage?.nombreCompte ?? vague.nombreInitial - totalMortalites;

  // Jours ecoules
  const now = vague.dateFin ?? new Date();
  const joursEcoules = Math.floor(
    (now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Indicateurs calcules via fonctions pures de calculs.ts
  const tauxSurvie = calculerTauxSurvie(nombreVivants, vague.nombreInitial);
  const gainPoids = calculerGainPoids(poidsMoyen, vague.poidsMoyenInitial);
  const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  const sgr = calculerSGR(vague.poidsMoyenInitial, poidsMoyen, joursEcoules);
  const biomasseInitiale = calculerBiomasse(vague.poidsMoyenInitial, vague.nombreInitial);
  const gainBiomasse = biomasse !== null && biomasseInitiale !== null
    ? biomasse - biomasseInitiale
    : null;
  const fcr = calculerFCR(totalAliment, gainBiomasse);

  return {
    tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
    fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
    sgr: sgr !== null ? Math.round(sgr * 100) / 100 : null,
    biomasse: biomasse !== null ? Math.round(biomasse * 100) / 100 : null,
    poidsMoyen,
    tailleMoyenne,
    nombreVivants,
    totalMortalites,
    totalAliment: Math.round(totalAliment * 100) / 100,
    gainPoids,
    joursEcoules,
  };
}
