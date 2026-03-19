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
      bacs: { select: { id: true, nombrePoissons: true } },
      releves: {
        orderBy: { date: "asc" },
        select: {
          typeReleve: true,
          date: true,
          bacId: true,
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

  // Moyenne ponderee des biometries par bac
  // Grouper par bac, garder la derniere par bac (releves tries par date asc)
  const biometriesParBac = new Map<string, (typeof biometries)[0]>();
  for (const b of biometries) {
    if (b.bacId) biometriesParBac.set(b.bacId, b);
  }

  let poidsMoyen: number | null = null;
  let tailleMoyenne: number | null = null;

  if (biometriesParBac.size > 0) {
    let totalPoids = 0;
    let totalTaille = 0;
    let totalPoissons = 0;
    let hasTaille = false;

    for (const [bacId, bio] of biometriesParBac) {
      const bac = vague.bacs.find((b) => b.id === bacId);
      const n = bac?.nombrePoissons ?? 1;
      if (bio.poidsMoyen !== null) {
        totalPoids += bio.poidsMoyen * n;
        totalPoissons += n;
      }
      if (bio.tailleMoyenne !== null) {
        totalTaille += bio.tailleMoyenne * n;
        hasTaille = true;
      }
    }

    if (totalPoissons > 0) {
      poidsMoyen = Math.round((totalPoids / totalPoissons) * 100) / 100;
      tailleMoyenne = hasTaille
        ? Math.round((totalTaille / totalPoissons) * 100) / 100
        : null;
    }
  } else if (biometries.length > 0) {
    // Fallback: pas de bacId sur les releves, utiliser le dernier releve
    const derniereBiometrie = biometries.at(-1);
    poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;
    tailleMoyenne = derniereBiometrie?.tailleMoyenne ?? null;
  }

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
