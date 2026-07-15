import { prisma } from "@/lib/db";
import { TypeReleve, CauseMortalite } from "@/types";
import type { IndicateursVague } from "@/types";
import {
  calculerTauxSurvie,
  calculerGainPoids,
  calculerSGR,
  calculerFCR,
  calculerBiomasse,
  computeVivantsByBac,
  computeNombreVivantsVague,
} from "@/lib/calculs";
import { getTransfertGroupesByVague } from "@/lib/queries/transferts";

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
      // ADR-043 Phase 3: lire nombreInitial/poidsMoyenInitial depuis AssignationBac
      assignations: {
        where: { dateFin: null },
        select: {
          nombreInitial: true,
          poidsMoyenInitial: true,
          bac: { select: { id: true } },
        },
      },
      releves: {
        orderBy: { date: "asc" },
        select: {
          typeReleve: true,
          date: true,
          bacId: true,
          poidsMoyen: true,
          tailleMoyenne: true,
          nombreMorts: true,
          nombreVendus: true,
          nombreTransferes: true,
          quantiteAliment: true,
          nombreCompte: true,
          causeMortalite: true,
          transfertGroupeId: true,
        },
      },
    },
  });

  if (!vague) return null;

  // AV.5 : perte de poids transport = SUM(poidsTotalKg - poidsLivreKg) sur les lignes
  // de vente livrees (poidsLivreKg renseigne) rattachees a cette vague.
  const lignesLivrees = await prisma.ligneVente.findMany({
    where: { vagueId, siteId, poidsLivreKg: { not: null } },
    select: { poidsTotalKg: true, poidsLivreKg: true },
  });
  const pertePoidsTransportKg =
    lignesLivrees.length > 0
      ? Math.round(
          lignesLivrees.reduce(
            (sum, l) => sum + (l.poidsTotalKg - (l.poidsLivreKg as number)),
            0
          ) * 100
        ) / 100
      : null;

  // CS.2 / GV.1-GV.2 : charger les TransfertGroupe pour discriminer, PAR RELEVÉ,
  // les TRANSFERT entrants (vague GROSSISSEMENT) des sortants.
  const transfertGroupesById = await getTransfertGroupesByVague(siteId, vagueId);

  // ADR-043 Phase 3: build bacs list from active assignations
  const bacsFromAssignations = vague.assignations.map((a) => ({
    id: a.bac.id,
    nombreInitial: a.nombreInitial,
    poidsMoyenInitial: a.poidsMoyenInitial,
  }));

  // Separer les releves par type
  const biometries = vague.releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
  const mortalites = vague.releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
  const alimentations = vague.releves.filter(
    (r) => r.typeReleve === TypeReleve.ALIMENTATION
  );
  const comptages = vague.releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

  // AV.5 : detail mortalites elevage vs avarie (transport). Sous-ensembles de totalMortalites,
  // ne change ni totalMortalites ni tauxSurvie.
  const mortalitesElevage = mortalites.reduce(
    (sum, r) => sum + (r.causeMortalite !== CauseMortalite.AVARIE ? (r.nombreMorts ?? 0) : 0),
    0
  );
  const mortalitesAvarie = mortalites.reduce(
    (sum, r) => sum + (r.causeMortalite === CauseMortalite.AVARIE ? (r.nombreMorts ?? 0) : 0),
    0
  );

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

  if (hasPerBacReleves && bacsFromAssignations.length > 0) {
    // --- Per-bac calculation: biomasse = SUM(biomasse_bac), poidsMoyen weighted by vivants ---
    const nombreInitialParBac = Math.round(vague.nombreInitial / bacsFromAssignations.length);

    const vivantsByBac = computeVivantsByBac(bacsFromAssignations, vague.releves, vague.nombreInitial, { transfertGroupesById });

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

    for (const bac of bacsFromAssignations) {
      // Nombre initial par bac: valeur per-bac si définie, sinon répartition uniforme
      const initialBac = bac.nombreInitial ?? nombreInitialParBac;
      totalNombreInitialBacs += initialBac;

      // Poids moyen initial par bac: valeur per-bac si définie, sinon vague-level
      const poidsInitialBac = bac.poidsMoyenInitial ?? vague.poidsMoyenInitial;
      totalPoidsInitialWeighted += poidsInitialBac * initialBac;

      // Vivants par bac from shared function
      const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
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
    // Sum ALL mortality relevés on the vague, not just the active bacs.
    // Closed AssignationBac (bacs reassigned to other vagues) still have mortality
    // relevés tied to this vague — they must be counted to compute the true survival rate.
    totalMortalites = mortalites.reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
    biomasse = hasBiomasse ? Math.round(totalBiomasse * 100) / 100 : null;

    if (totalVivantsForWeight > 0) {
      poidsMoyen = Math.round((totalPoidsWeighted / totalVivantsForWeight) * 100) / 100;
      tailleMoyenne = hasTaille
        ? Math.round((totalTailleWeighted / totalVivantsForWeight) * 100) / 100
        : null;
    }

    // Fallback : si aucun bac actif n'a de biométrie, utiliser la dernière biométrie
    // connue sur la vague (peut venir d'un bac dont l'assignation est fermée).
    // Cas typique : vague qui a transféré la quasi-totalité de ses poissons,
    // laissant un petit reliquat sur un bac sans biométrie locale.
    // biometries est triée par date asc (orderBy: { date: "asc" }) → at(-1) = la plus récente.
    if (totalVivantsForWeight === 0 && biometries.length > 0) {
      const derniereBiometrie = biometries.at(-1);
      if (derniereBiometrie?.poidsMoyen != null) {
        poidsMoyen = derniereBiometrie.poidsMoyen;
        tailleMoyenne = derniereBiometrie.tailleMoyenne ?? null;
        biomasse = calculerBiomasse(poidsMoyen, totalVivantsAll);
      }
    }
  } else {
    // --- Fallback: no bacId on releves, use global logic ---
    totalMortalites = mortalites.reduce(
      (sum, r) => sum + (r.nombreMorts ?? 0),
      0
    );

    nombreVivants = computeNombreVivantsVague(bacsFromAssignations, vague.releves, vague.nombreInitial, { transfertGroupesById });

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
  // Toujours utiliser vague.nombreInitial comme reference (Fix 3 — survie post-calibrage)
  const nombreInitialEffectif = vague.nombreInitial;
  const poidsMoyenInitialEffectif = hasPerBacReleves && bacsFromAssignations.length > 0 && totalNombreInitialBacs > 0
    ? totalPoidsInitialWeighted / totalNombreInitialBacs
    : vague.poidsMoyenInitial;

  // Sprint SV fix: tauxSurvie = (initial - morts) / initial — ventes/transferts ne sont pas des morts
  const tauxSurvie = calculerTauxSurvie(nombreInitialEffectif, totalMortalites);
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
    mortalitesElevage,
    mortalitesAvarie,
    pertePoidsTransportKg,
    totalAliment: Math.round(totalAliment * 100) / 100,
    gainPoids,
    joursEcoules,
  };
}
