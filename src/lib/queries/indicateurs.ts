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
      bacs: { select: { id: true, nombrePoissons: true, nombreInitial: true, poidsMoyenInitial: true } },
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

  // Total aliment (global, pas par bac)
  const totalAliment = alimentations.reduce(
    (sum, r) => sum + (r.quantiteAliment ?? 0),
    0
  );

  // Check if releves have bacId (per-bac calculation possible)
  const hasPerBacReleves = vague.releves.some((r) => r.bacId !== null);

  let poidsMoyen: number | null = null;
  let tailleMoyenne: number | null = null;
  let nombreVivants: number;
  let totalMortalites: number;
  let biomasse: number | null = null;
  let totalNombreInitialBacs = 0;
  let totalPoidsInitialWeighted = 0;

  if (hasPerBacReleves && vague.bacs.length > 0) {
    // --- Per-bac calculation: biomasse = SUM(biomasse_bac), poidsMoyen weighted by vivants ---
    const nombreInitialParBac = Math.round(vague.nombreInitial / vague.bacs.length);

    // Group mortalites by bacId
    const mortsParBac = new Map<string, number>();
    for (const r of mortalites) {
      if (r.bacId) {
        mortsParBac.set(r.bacId, (mortsParBac.get(r.bacId) ?? 0) + (r.nombreMorts ?? 0));
      }
    }

    // Group comptages by bacId, keep last per bac (releves sorted by date asc)
    const comptagesParBac = new Map<string, number>();
    for (const r of comptages) {
      if (r.bacId && r.nombreCompte !== null) {
        comptagesParBac.set(r.bacId, r.nombreCompte);
      }
    }

    // Group biometries by bacId, keep last per bac
    const biometriesParBac = new Map<string, (typeof biometries)[0]>();
    for (const b of biometries) {
      if (b.bacId) biometriesParBac.set(b.bacId, b);
    }

    let totalBiomasse = 0;
    let hasBiomasse = false;
    let totalPoidsWeighted = 0;
    let totalTailleWeighted = 0;
    let totalVivantsForWeight = 0;
    let hasTaille = false;
    let totalVivantsAll = 0;
    let totalMortsAll = 0;

    for (const bac of vague.bacs) {
      const mortsBac = mortsParBac.get(bac.id) ?? 0;
      totalMortsAll += mortsBac;

      // Nombre initial par bac: valeur per-bac si définie, sinon répartition uniforme
      const initialBac = bac.nombreInitial ?? nombreInitialParBac;
      totalNombreInitialBacs += initialBac;

      // Poids moyen initial par bac: valeur per-bac si définie, sinon vague-level
      const poidsInitialBac = bac.poidsMoyenInitial ?? vague.poidsMoyenInitial;
      totalPoidsInitialWeighted += poidsInitialBac * initialBac;

      // Vivants par bac: dernier comptage OU (stocking initial par bac - morts)
      const comptage = comptagesParBac.get(bac.id);
      const vivantsBac = comptage ?? (initialBac - mortsBac);
      totalVivantsAll += vivantsBac;

      // Biomasse par bac
      const bio = biometriesParBac.get(bac.id);
      if (bio && bio.poidsMoyen !== null) {
        const biomasseBac = bio.poidsMoyen * vivantsBac / 1000;
        totalBiomasse += biomasseBac;
        hasBiomasse = true;

        // Accumulate for weighted average
        totalPoidsWeighted += bio.poidsMoyen * vivantsBac;
        totalVivantsForWeight += vivantsBac;

        if (bio.tailleMoyenne !== null) {
          totalTailleWeighted += bio.tailleMoyenne * vivantsBac;
          hasTaille = true;
        }
      }
    }

    nombreVivants = totalVivantsAll;
    totalMortalites = totalMortsAll;
    biomasse = hasBiomasse ? Math.round(totalBiomasse * 100) / 100 : null;

    if (totalVivantsForWeight > 0) {
      poidsMoyen = Math.round((totalPoidsWeighted / totalVivantsForWeight) * 100) / 100;
      tailleMoyenne = hasTaille
        ? Math.round((totalTailleWeighted / totalVivantsForWeight) * 100) / 100
        : null;
    }
  } else {
    // --- Fallback: no bacId on releves, use global logic ---
    totalMortalites = mortalites.reduce(
      (sum, r) => sum + (r.nombreMorts ?? 0),
      0
    );

    const dernierComptage = comptages.at(-1);
    nombreVivants =
      dernierComptage?.nombreCompte ?? vague.nombreInitial - totalMortalites;

    if (biometries.length > 0) {
      const derniereBiometrie = biometries.at(-1);
      poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;
      tailleMoyenne = derniereBiometrie?.tailleMoyenne ?? null;
    }

    biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  }

  // Jours ecoules
  const now = vague.dateFin ?? new Date();
  const joursEcoules = Math.floor(
    (now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Indicateurs calcules via fonctions pures de calculs.ts
  // Utiliser les totaux per-bac si disponibles, sinon vague-level
  const nombreInitialEffectif = hasPerBacReleves && vague.bacs.length > 0
    ? totalNombreInitialBacs
    : vague.nombreInitial;
  const poidsMoyenInitialEffectif = hasPerBacReleves && vague.bacs.length > 0 && totalNombreInitialBacs > 0
    ? totalPoidsInitialWeighted / totalNombreInitialBacs
    : vague.poidsMoyenInitial;

  const tauxSurvie = calculerTauxSurvie(nombreVivants, nombreInitialEffectif);
  const gainPoids = calculerGainPoids(poidsMoyen, poidsMoyenInitialEffectif);
  const sgr = calculerSGR(poidsMoyenInitialEffectif, poidsMoyen, joursEcoules);
  const biomasseInitiale = calculerBiomasse(poidsMoyenInitialEffectif, nombreInitialEffectif);
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
