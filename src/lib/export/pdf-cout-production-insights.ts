/**
 * Génère des insights contextuels pour le rapport PDF coût de production.
 *
 * Logique 100% règles métier — pas d'IA.
 * Produit des phrases d'analyse pertinentes basées sur les données réelles.
 */

import type { CoutProductionVague } from "@/lib/queries/finances";
import { StatutVague } from "@/types";

export interface PdfInsights {
  /** Résumé exécutif en haut du rapport (2-3 phrases) */
  executive: string[];
  /** Insight sur la production (biomasse, durée, objectif) */
  production: string[];
  /** Insight sur la structure des coûts */
  couts: string[];
  /** Insight sur l'alimentation */
  alimentation: string[];
  /** Insight sur la rentabilité */
  rentabilite: string[];
  /** Insight sur les ventes */
  ventes: string[];
}

export function generatePdfInsights(cp: CoutProductionVague): PdfInsights {
  const { vague, resume, coutParCategorie, detailAliments, ventes, formule } = cp;
  const coutsParents = cp.coutsParents;
  const cycleComplet = cp.cycleComplet;

  const insights: PdfInsights = {
    executive: [],
    production: [],
    couts: [],
    alimentation: [],
    rentabilite: [],
    ventes: [],
  };

  // -------------------------------------------------------------------------
  // Résumé exécutif
  // -------------------------------------------------------------------------

  // Cycle complet (si includeParents)
  if (coutsParents && coutsParents.coutTotalImpute > 0) {
    const ratioMoyen =
      coutsParents.details.length > 0
        ? coutsParents.details.reduce((s, d) => s + d.ratio, 0) / coutsParents.details.length
        : 0;
    insights.executive.push(
      `Cycle complet : ${formatK(coutsParents.coutTotalImpute)} de coûts pré-grossissement imputés sur ${coutsParents.details.length} vague${coutsParents.details.length > 1 ? "s" : ""} parente${coutsParents.details.length > 1 ? "s" : ""} (ratio moyen ${(ratioMoyen * 100).toFixed(0)}%).`
    );
  }

  // Statut de la vague
  if (vague.statut === StatutVague.TERMINEE) {
    insights.executive.push(
      `Vague terminée après ${vague.dureeJours} jours de production avec ${vague.nombreInitial} poissons initiaux.`
    );
  } else if (vague.statut === StatutVague.EN_COURS) {
    insights.executive.push(
      `Vague en cours depuis ${vague.dureeJours} jours (${vague.nombreInitial} poissons initiaux). Rapport intermédiaire.`
    );
  } else {
    insights.executive.push(
      `Vague annulée après ${vague.dureeJours} jours.`
    );
  }

  // Verdict rentabilité
  if (resume.marge > 0 && resume.roi !== null) {
    if (resume.roi >= 100) {
      insights.executive.push(
        `Excellente rentabilité : investissement récupéré ${(resume.roi / 100).toFixed(1)}× avec une marge de ${formatK(resume.marge)}.`
      );
    } else if (resume.roi >= 50) {
      insights.executive.push(
        `Bonne rentabilité : ROI de ${resume.roi.toFixed(0)}% avec une marge nette de ${formatK(resume.marge)}.`
      );
    } else if (resume.roi >= 0) {
      insights.executive.push(
        `Rentabilité modeste : ROI de ${resume.roi.toFixed(0)}%. La marge de ${formatK(resume.marge)} couvre les coûts mais reste faible.`
      );
    }
  } else if (resume.marge < 0) {
    insights.executive.push(
      `Vague déficitaire : les coûts dépassent les revenus de ${formatK(Math.abs(resume.marge))}. ROI négatif.`
    );
  } else if (resume.revenus === 0 && vague.statut === StatutVague.EN_COURS) {
    insights.executive.push(
      `Aucune vente réalisée à ce stade. Les coûts engagés s'élèvent à ${formatK(resume.coutTotal)}.`
    );
  }

  // -------------------------------------------------------------------------
  // Production
  // -------------------------------------------------------------------------

  if (resume.biomasseProduite !== null && resume.biomasseProduite > 0) {
    const totalProduit = resume.biomasseProduite;
    const pctVendu = resume.poidsTotalVendu > 0
      ? ((resume.poidsTotalVendu / totalProduit) * 100).toFixed(0)
      : "0";

    insights.production.push(
      `Biomasse totale produite : ${formatKg(totalProduit)} (vivante + vendue).`
    );

    if (resume.poidsTotalVendu > 0 && resume.biomasseKg !== null && resume.biomasseKg > 0) {
      insights.production.push(
        `${pctVendu}% de la production a été vendue (${formatKg(resume.poidsTotalVendu)}), ${formatKg(resume.biomasseKg)} restent en bassin.`
      );
    } else if (resume.poidsTotalVendu > 0 && (resume.biomasseKg === null || resume.biomasseKg === 0)) {
      insights.production.push(
        `Toute la production a été vendue : ${formatKg(resume.poidsTotalVendu)} écoulés.`
      );
    }
  }

  if (resume.nombrePoissonsVendus > 0) {
    const pctPoissonsVendus = ((resume.nombrePoissonsVendus / vague.nombreInitial) * 100).toFixed(0);
    insights.production.push(
      `${resume.nombrePoissonsVendus} poissons vendus sur ${vague.nombreInitial} initiaux (${pctPoissonsVendus}% du lot).`
    );
  }

  // Productivité par jour
  if (resume.biomasseProduite !== null && resume.biomasseProduite > 0 && vague.dureeJours > 0) {
    const kgParJour = resume.biomasseProduite / vague.dureeJours;
    if (kgParJour >= 1) {
      insights.production.push(
        `Productivité moyenne : ${kgParJour.toFixed(1)} kg/jour sur la période.`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Structure des coûts
  // -------------------------------------------------------------------------

  if (coutParCategorie.length > 0) {
    // Poste dominant
    const sorted = [...coutParCategorie].sort((a, b) => b.pourcentage - a.pourcentage);
    const dominant = sorted[0];
    if (dominant.pourcentage >= 70) {
      insights.couts.push(
        `L'alimentation représente ${dominant.pourcentage.toFixed(0)}% du coût total — poste largement dominant. L'optimisation de ce poste aura le plus grand impact sur la rentabilité.`
      );
    } else if (dominant.pourcentage >= 50) {
      insights.couts.push(
        `Le poste principal (${labelCat(dominant.categorie)}) représente ${dominant.pourcentage.toFixed(0)}% des coûts.`
      );
    } else {
      insights.couts.push(
        `Les coûts sont répartis de manière relativement équilibrée entre ${coutParCategorie.length} catégories.`
      );
    }

    // Coût par kg context
    if (resume.coutParKg !== null && resume.prixMoyenVenteKg !== null) {
      const ratio = resume.coutParKg / resume.prixMoyenVenteKg;
      if (ratio <= 0.4) {
        insights.couts.push(
          `Le coût de production par kg (${Math.round(resume.coutParKg)} FCFA) ne représente que ${(ratio * 100).toFixed(0)}% du prix de vente — marge très confortable.`
        );
      } else if (ratio <= 0.6) {
        insights.couts.push(
          `Le coût de production par kg (${Math.round(resume.coutParKg)} FCFA) représente ${(ratio * 100).toFixed(0)}% du prix de vente — marge correcte.`
        );
      } else if (ratio <= 0.85) {
        insights.couts.push(
          `Le coût de production par kg (${Math.round(resume.coutParKg)} FCFA) représente ${(ratio * 100).toFixed(0)}% du prix de vente — marge serrée, vigilance nécessaire.`
        );
      } else {
        insights.couts.push(
          `Attention : le coût de production par kg (${Math.round(resume.coutParKg)} FCFA) représente ${(ratio * 100).toFixed(0)}% du prix de vente. Marge insuffisante.`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Alimentation
  // -------------------------------------------------------------------------

  if (detailAliments.length > 0) {
    const totalAliment = detailAliments.reduce((s, a) => s + a.total, 0);
    const totalQte = detailAliments.reduce((s, a) => s + a.quantite, 0);

    if (detailAliments.length === 1) {
      insights.alimentation.push(
        `Un seul type d'aliment utilisé : ${detailAliments[0].produit}. ${formatKg(totalQte)} consommés pour un coût de ${formatK(totalAliment)}.`
      );
    } else {
      const plusCher = [...detailAliments].sort((a, b) => b.prixUnitaire - a.prixUnitaire)[0];
      const plusUtilise = [...detailAliments].sort((a, b) => b.quantite - a.quantite)[0];
      insights.alimentation.push(
        `${detailAliments.length} types d'aliments utilisés pour un total de ${formatKg(totalQte)} et ${formatK(totalAliment)}.`
      );
      if (plusCher.produit !== plusUtilise.produit) {
        insights.alimentation.push(
          `Aliment le plus utilisé : ${plusUtilise.produit} (${formatKg(plusUtilise.quantite)}). Le plus coûteux au kg : ${plusCher.produit} (${Math.round(plusCher.prixUnitaire)} FCFA/kg).`
        );
      }
    }

    // Coût aliment par poisson initial
    if (vague.nombreInitial > 0) {
      const coutParPoisson = totalAliment / vague.nombreInitial;
      insights.alimentation.push(
        `Coût alimentaire moyen par poisson initial : ${Math.round(coutParPoisson)} FCFA.`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Ventes
  // -------------------------------------------------------------------------

  if (ventes.length > 0) {
    const totalVentes = ventes.reduce((s, v) => s + v.montant, 0);
    const totalKg = ventes.reduce((s, v) => s + v.poidsKg, 0);
    const prixMoyenEffectif = totalKg > 0 ? totalVentes / totalKg : 0;

    insights.ventes.push(
      `${ventes.length} vente${ventes.length > 1 ? "s" : ""} réalisée${ventes.length > 1 ? "s" : ""} pour un total de ${formatK(totalVentes)} (${formatKg(totalKg)} écoulés).`
    );

    if (ventes.length > 1) {
      // Variation de prix
      const prix = ventes.map((v) => v.poidsKg > 0 ? v.montant / v.poidsKg : 0).filter((p) => p > 0);
      const minPrix = Math.min(...prix);
      const maxPrix = Math.max(...prix);
      if (maxPrix > minPrix * 1.1) {
        insights.ventes.push(
          `Prix de vente entre ${Math.round(minPrix)} et ${Math.round(maxPrix)} FCFA/kg (moyenne pondérée : ${Math.round(prixMoyenEffectif)} FCFA/kg).`
        );
      } else {
        insights.ventes.push(
          `Prix de vente stable autour de ${Math.round(prixMoyenEffectif)} FCFA/kg.`
        );
      }

      // Meilleur client
      const clientMap = new Map<string, number>();
      for (const v of ventes) {
        clientMap.set(v.client, (clientMap.get(v.client) ?? 0) + v.montant);
      }
      if (clientMap.size > 1) {
        const topClient = [...clientMap.entries()].sort((a, b) => b[1] - a[1])[0];
        const pctTop = ((topClient[1] / totalVentes) * 100).toFixed(0);
        insights.ventes.push(
          `Principal client : ${topClient[0]} (${pctTop}% du chiffre d'affaires).`
        );
      }
    }

    // Chronologie ventes
    const dates = ventes.map((v) => new Date(v.date).getTime());
    const premiere = new Date(Math.min(...dates));
    const derniere = new Date(Math.max(...dates));
    if (ventes.length > 1) {
      const joursVente = Math.ceil((derniere.getTime() - premiere.getTime()) / (1000 * 60 * 60 * 24));
      if (joursVente > 1) {
        insights.ventes.push(
          `Ventes étalées sur ${joursVente} jours (du ${formatDateShort(premiere)} au ${formatDateShort(derniere)}).`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Rentabilité
  // -------------------------------------------------------------------------

  // ROI cycle complet vs vague isolée
  if (cycleComplet && cycleComplet.roiCycleComplet !== null && resume.roi !== null) {
    const diff = cycleComplet.roiCycleComplet - resume.roi;
    insights.rentabilite.push(
      `ROI cycle complet : ${cycleComplet.roiCycleComplet.toFixed(1)}% (ROI vague isolée : ${resume.roi.toFixed(1)}% — écart : ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%).`
    );
  }

  if (resume.revenus > 0) {
    // Seuil de rentabilité
    if (resume.prixMoyenVenteKg !== null && resume.coutTotal > 0) {
      const seuilKg = resume.coutTotal / resume.prixMoyenVenteKg;
      insights.rentabilite.push(
        `Seuil de rentabilité : ${formatKg(seuilKg)} à vendre au prix moyen de ${Math.round(resume.prixMoyenVenteKg)} FCFA/kg pour couvrir les coûts.`
      );
      if (resume.poidsTotalVendu >= seuilKg) {
        const surplus = resume.poidsTotalVendu - seuilKg;
        insights.rentabilite.push(
          `Seuil dépassé de ${formatKg(surplus)} — chaque kg supplémentaire vendu est du bénéfice net.`
        );
      } else {
        const manque = seuilKg - resume.poidsTotalVendu;
        insights.rentabilite.push(
          `Il reste ${formatKg(manque)} à vendre pour atteindre l'équilibre financier.`
        );
      }
    }

    // Marge par poisson vendu
    if (resume.nombrePoissonsVendus > 0) {
      const margeParPoisson = resume.marge / resume.nombrePoissonsVendus;
      if (margeParPoisson > 0) {
        insights.rentabilite.push(
          `Marge nette par poisson vendu : ${Math.round(margeParPoisson)} FCFA.`
        );
      }
    }

    // Comparaison avec investissement initial
    if (resume.roi !== null) {
      if (resume.roi >= 200) {
        insights.rentabilite.push(
          `Pour chaque 1 000 FCFA investi, ${Math.round(resume.roi * 10)} FCFA ont été générés en bénéfice. Performance remarquable.`
        );
      } else if (resume.roi >= 100) {
        insights.rentabilite.push(
          `L'investissement a été entièrement récupéré et a généré ${resume.roi.toFixed(0)}% de plus en bénéfice.`
        );
      } else if (resume.roi >= 0) {
        insights.rentabilite.push(
          `L'investissement a généré un rendement de ${resume.roi.toFixed(0)}%. Rentable mais avec une marge d'amélioration.`
        );
      }
    }
  } else if (resume.coutTotal > 0 && resume.revenus === 0) {
    insights.rentabilite.push(
      `Aucune vente enregistrée. L'intégralité des ${formatK(resume.coutTotal)} investis est en attente de retour.`
    );
    if (resume.biomasseKg !== null && resume.biomasseKg > 0 && resume.coutParKg !== null) {
      insights.rentabilite.push(
        `Au prix coûtant, la biomasse en bassin (${formatKg(resume.biomasseKg)}) représente un actif de ${formatK(resume.biomasseKg * resume.coutParKg)}.`
      );
    }
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatK(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M FCFA`;
  }
  if (abs >= 10_000) {
    return `${Math.round(n / 1000)}k FCFA`;
  }
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function formatKg(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString("fr-FR")} kg`;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function labelCat(cat: string): string {
  const map: Record<string, string> = {
    ALIMENT: "alimentation",
    INTRANT: "intrants",
    EQUIPEMENT: "équipement",
    ELECTRICITE: "électricité",
    EAU: "eau",
    LOYER: "loyer",
    SALAIRE: "salaires",
    TRANSPORT: "transport",
    VETERINAIRE: "vétérinaire",
    REPARATION: "réparation",
    INVESTISSEMENT: "investissement",
    AUTRE: "autre",
    MULTI_VAGUE: "coûts partagés",
  };
  return map[cat] ?? cat;
}
