/**
 * Génère des insights contextuels pour le rapport PDF de vague.
 *
 * Logique 100% règles métier — pas d'IA.
 * Produit des phrases d'analyse pertinentes basées sur les données réelles.
 */

import type { CreateRapportVaguePDFDTO } from "@/types/export";
import { StatutVague } from "@/types";

export interface RapportVagueInsights {
  /** Résumé exécutif en haut du rapport (2-4 phrases) */
  executive: string[];
  /** Insight sur les indicateurs zootechniques */
  zootechnique: string[];
  /** Insight sur la croissance (biométries + Gompertz) */
  croissance: string[];
  /** Insight sur la mortalité */
  mortalite: string[];
  /** Insight sur l'alimentation */
  alimentation: string[];
  /** Insight sur les ventes */
  ventes: string[];
  /** Insight sur le coût de production / rentabilité */
  rentabilite: string[];
  /** Insight sur le lineage (origine des poissons, cycle complet) */
  lineage: string[];
}

export function generateRapportVagueInsights(data: CreateRapportVaguePDFDTO): RapportVagueInsights {
  const insights: RapportVagueInsights = {
    executive: [],
    zootechnique: [],
    croissance: [],
    mortalite: [],
    alimentation: [],
    ventes: [],
    rentabilite: [],
    lineage: [],
  };

  const dureeJours = Math.ceil(
    (new Date(data.dateFin ?? Date.now()).getTime() - new Date(data.dateDebut).getTime()) / (1000 * 60 * 60 * 24)
  );

  // -------------------------------------------------------------------------
  // Résumé exécutif
  // -------------------------------------------------------------------------

  if (data.statut === StatutVague.EN_COURS) {
    insights.executive.push(
      `Vague en cours depuis ${dureeJours} jours avec ${data.nombreInitial} alevins de ${data.poidsMoyenInitial}g mis en eau le ${fmtDate(data.dateDebut)}.`
    );
  } else if (data.statut === StatutVague.TERMINEE) {
    insights.executive.push(
      `Vague terminée après ${dureeJours} jours de production (${data.nombreInitial} alevins de ${data.poidsMoyenInitial}g).`
    );
  } else {
    insights.executive.push(
      `Vague annulée après ${dureeJours} jours. Effectif initial : ${data.nombreInitial} alevins.`
    );
  }

  // Survie + croissance résumé
  const survie = data.kpis.tauxSurvie;
  const poidsFinal = data.kpis.poidsMoyenFinal;
  if (survie !== null && poidsFinal !== null) {
    const gainMultiple = poidsFinal / data.poidsMoyenInitial;
    const survieQual = survie >= 90 ? "excellent" : survie >= 75 ? "correct" : survie >= 50 ? "faible" : "critique";
    insights.executive.push(
      `Taux de survie ${survieQual} (${survie.toFixed(0)}%). Poids moyen passé de ${data.poidsMoyenInitial}g à ${Math.round(poidsFinal)}g (×${gainMultiple.toFixed(1)}) en ${dureeJours} jours.`
    );
  }

  // Verdict rentabilité en résumé
  if (data.coutProduction && data.salesSummary) {
    const cp = data.coutProduction.resume;
    if (cp.roi !== null && cp.roi > 0) {
      insights.executive.push(
        `Rentabilité positive : ROI de ${cp.roi.toFixed(0)}% avec une marge de ${cp.margeParKg !== null ? Math.round(cp.margeParKg) : "—"} FCFA/kg.`
      );
    } else if (cp.roi !== null && cp.roi < 0) {
      insights.executive.push(
        `Vague déficitaire (ROI ${cp.roi.toFixed(0)}%). Le coût par kg (${fmtFCFA(cp.coutParKg)}) dépasse le prix de vente.`
      );
    } else if (data.salesSummary.totalMontant === 0 && data.statut === StatutVague.EN_COURS) {
      insights.executive.push(
        `Aucune vente à ce stade. Coûts engagés : ${fmtFCFA(cp.coutTotal)}.`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Indicateurs zootechniques
  // -------------------------------------------------------------------------

  if (survie !== null) {
    const mortsTotal = data.mortalitySummary?.totalMorts ?? 0;
    if (survie >= 90) {
      insights.zootechnique.push(
        `Taux de survie de ${survie.toFixed(1)}% — très bon résultat. Seulement ${mortsTotal} pertes sur ${data.nombreInitial} alevins.`
      );
    } else if (survie >= 75) {
      insights.zootechnique.push(
        `Taux de survie de ${survie.toFixed(1)}% — dans la norme. ${mortsTotal} pertes enregistrées.`
      );
    } else if (survie >= 50) {
      insights.zootechnique.push(
        `Taux de survie faible (${survie.toFixed(1)}%). ${mortsTotal} poissons perdus sur ${data.nombreInitial}. Analyse des causes de mortalité recommandée.`
      );
    } else {
      insights.zootechnique.push(
        `Taux de survie critique (${survie.toFixed(1)}%). ${mortsTotal} pertes — soit plus de la moitié de l'effectif initial.`
      );
    }
  }

  if (data.kpis.fcr !== null) {
    if (data.kpis.fcr <= 1.5) {
      insights.zootechnique.push(
        `TCA de ${data.kpis.fcr.toFixed(2)} — conversion alimentaire excellente (< 1.5).`
      );
    } else if (data.kpis.fcr <= 2.0) {
      insights.zootechnique.push(
        `TCA de ${data.kpis.fcr.toFixed(2)} — conversion alimentaire bonne (< 2.0).`
      );
    } else if (data.kpis.fcr <= 3.0) {
      insights.zootechnique.push(
        `TCA de ${data.kpis.fcr.toFixed(2)} — conversion alimentaire correcte mais avec marge d'optimisation.`
      );
    } else {
      insights.zootechnique.push(
        `TCA de ${data.kpis.fcr.toFixed(2)} — conversion alimentaire élevée. Revoir la qualité de l'aliment ou la stratégie de rationnement.`
      );
    }
  }

  if (data.kpis.biomasseTotale !== null && data.kpis.biomasseTotale > 0) {
    const bioKgParPoisson = (data.kpis.biomasseTotale / (data.kpis.nombreActuel || 1));
    insights.zootechnique.push(
      `Biomasse totale estimée : ${data.kpis.biomasseTotale.toFixed(1)} kg (${data.kpis.nombreActuel} poissons, ~${(bioKgParPoisson * 1000).toFixed(0)}g/poisson).`
    );
  }

  // -------------------------------------------------------------------------
  // Croissance (biométries + Gompertz)
  // -------------------------------------------------------------------------

  if (data.evolutionPoidsMoyen && data.evolutionPoidsMoyen.length >= 2) {
    const first = data.evolutionPoidsMoyen[0];
    const last = data.evolutionPoidsMoyen[data.evolutionPoidsMoyen.length - 1];
    const gainTotal = (last.poidsMoyenMesure ?? 0) - (first.poidsMoyenMesure ?? 0);
    const joursEvol = (last.jourDepuisDebut ?? 0) - (first.jourDepuisDebut ?? 0);
    const gmq = joursEvol > 0 ? gainTotal / joursEvol : 0;

    if (gainTotal > 0) {
      insights.croissance.push(
        `Croissance de ${(first.poidsMoyenMesure ?? 0).toFixed(0)}g à ${(last.poidsMoyenMesure ?? 0).toFixed(0)}g en ${joursEvol} jours, soit un GMQ de ${gmq.toFixed(1)}g/jour.`
      );
    }

    // Comparer le dernier écart Gompertz
    if (data.gompertz && last.ecart !== null && last.ecart !== undefined) {
      if (last.ecart > 20) {
        insights.croissance.push(
          `La croissance dépasse les prédictions Gompertz de +${last.ecart.toFixed(0)}g — performance au-dessus du modèle théorique.`
        );
      } else if (last.ecart < -20) {
        insights.croissance.push(
          `La croissance est en retard de ${Math.abs(last.ecart).toFixed(0)}g par rapport au modèle Gompertz — facteurs limitants possibles.`
        );
      } else {
        insights.croissance.push(
          `La croissance suit fidèlement le modèle Gompertz (écart de ${last.ecart >= 0 ? "+" : ""}${last.ecart.toFixed(0)}g).`
        );
      }
    }
  }

  if (data.gompertz) {
    if (data.gompertz.r2 !== null && data.gompertz.r2 >= 0.99) {
      insights.croissance.push(
        `Modèle Gompertz très fiable (R² = ${data.gompertz.r2.toFixed(4)}, confiance ${data.gompertz.confidenceLevel}).`
      );
    }
    if (data.gompertz.predictedHarvestDate) {
      insights.croissance.push(
        `Date de récolte prédite au ${data.gompertz.predictedHarvestDate} pour le poids cible de ${data.gompertz.targetWeight ?? "—"}g.`
      );
    }
  }

  // Analyse des écarts entre bacs
  if (data.evolutionPoidsTable && data.evolutionPoidsTable.length > 0) {
    // Grouper par date pour trouver les écarts entre bacs
    const lastDate = data.evolutionPoidsTable[data.evolutionPoidsTable.length - 1]?.date;
    if (lastDate) {
      const lastDateStr = new Date(lastDate).toISOString().split("T")[0];
      const lastDayRows = data.evolutionPoidsTable.filter(
        (r) => new Date(r.date).toISOString().split("T")[0] === lastDateStr && r.poidsMoyen !== null
      );
      if (lastDayRows.length >= 2) {
        const poids = lastDayRows.map((r) => r.poidsMoyen!);
        const min = Math.min(...poids);
        const max = Math.max(...poids);
        const ecart = max - min;
        if (ecart > 100) {
          insights.croissance.push(
            `Écart de ${Math.round(ecart)}g entre bacs à la dernière biométrie (${Math.round(min)}g — ${Math.round(max)}g). Les calibrages aident à homogénéiser les lots.`
          );
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mortalité
  // -------------------------------------------------------------------------

  if (data.mortalitySummary) {
    const ms = data.mortalitySummary;
    if (ms.totalMorts > 0 && ms.topCauses.length > 0) {
      const topCause = ms.topCauses[0];
      const pctTop = ms.totalMorts > 0 ? ((topCause.count / ms.totalMorts) * 100).toFixed(0) : "0";
      insights.mortalite.push(
        `${ms.totalMorts} morts au total (${ms.tauxMortalite.toFixed(1)}% de l'effectif). Cause principale : ${topCause.cause} (${topCause.count} cas, ${pctTop}%).`
      );

      if (ms.topCauses.length >= 2) {
        const causes = ms.topCauses.slice(0, 3).map((c) => `${c.cause} (${c.count})`).join(", ");
        insights.mortalite.push(
          `Répartition des causes : ${causes}.`
        );
      }

      // Mortalité calibrage spécifique
      const calibrageCause = ms.topCauses.find((c) => c.cause.toUpperCase().includes("CALIBRAGE"));
      if (calibrageCause && calibrageCause.count > 0) {
        const pctCalibrage = ((calibrageCause.count / ms.totalMorts) * 100).toFixed(0);
        insights.mortalite.push(
          `${calibrageCause.count} morts liées aux calibrages (${pctCalibrage}%). Ces pertes sont normales mais peuvent être réduites avec une manipulation plus douce.`
        );
      }

      // Mortalité avarie (transport)
      const avarieCause = ms.topCauses.find((c) => c.cause.toUpperCase().includes("AVARIE"));
      if (avarieCause && avarieCause.count > 0) {
        insights.mortalite.push(
          `${avarieCause.count} pertes en avarie (transport). Optimiser les conditions de transport pour réduire ces pertes.`
        );
      }
    } else if (ms.totalMorts === 0) {
      insights.mortalite.push(
        `Aucune mortalité enregistrée — résultat exceptionnel.`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Alimentation
  // -------------------------------------------------------------------------

  if (data.feedingSummary) {
    const fs = data.feedingSummary;
    if (fs.totalAlimentKg > 0) {
      insights.alimentation.push(
        `${fs.totalAlimentKg.toFixed(1)} kg d'aliment distribués sur ${dureeJours} jours, soit ${(fs.totalAlimentKg / dureeJours).toFixed(1)} kg/jour en moyenne.`
      );

      if (fs.frequenceMoyenne !== null) {
        if (fs.frequenceMoyenne >= 3) {
          insights.alimentation.push(
            `Fréquence de ${fs.frequenceMoyenne.toFixed(1)}x/jour — bon fractionnement des repas.`
          );
        } else if (fs.frequenceMoyenne >= 2) {
          insights.alimentation.push(
            `Fréquence de ${fs.frequenceMoyenne.toFixed(1)}x/jour — correcte. Un passage à 3x/jour peut améliorer la conversion.`
          );
        }
      }

      // Coût aliment par kg de poisson produit
      if (data.kpis.fcr !== null && data.coutProduction) {
        const coutAlimentParKg = data.coutProduction.resume.coutParKg !== null
          ? Math.round(data.coutProduction.resume.coutParKg * 0.7) // Approximation : alimentation ~70% du coût
          : null;
        if (coutAlimentParKg !== null) {
          insights.alimentation.push(
            `Avec un TCA de ${data.kpis.fcr.toFixed(2)}, chaque kg de poisson produit consomme ~${data.kpis.fcr.toFixed(1)} kg d'aliment.`
          );
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ventes
  // -------------------------------------------------------------------------

  if (data.salesSummary) {
    const ss = data.salesSummary;
    if (ss.ventes.length > 0) {
      insights.ventes.push(
        `${ss.ventes.length} vente${ss.ventes.length > 1 ? "s" : ""} réalisée${ss.ventes.length > 1 ? "s" : ""} : ${ss.totalPoissonsVendus} poissons pour ${ss.totalPoidsKg.toFixed(1)} kg, générant ${fmtFCFA(ss.totalMontant)}.`
      );

      // Objectif
      if (ss.poidsObjectifKg !== null && ss.poidsObjectifKg > 0) {
        const pctObjectif = (ss.totalPoidsKg / ss.poidsObjectifKg) * 100;
        if (pctObjectif >= 100) {
          insights.ventes.push(
            `Objectif de vente atteint : ${ss.totalPoidsKg.toFixed(1)} / ${ss.poidsObjectifKg.toFixed(1)} kg (${pctObjectif.toFixed(0)}%).`
          );
        } else {
          const resteKg = ss.poidsObjectifKg - ss.totalPoidsKg;
          insights.ventes.push(
            `Objectif de vente à ${pctObjectif.toFixed(0)}% (${ss.totalPoidsKg.toFixed(1)} / ${ss.poidsObjectifKg.toFixed(1)} kg). Reste ${resteKg.toFixed(1)} kg à écouler.`
          );
        }
      }

      // Prix moyen
      if (ss.totalPoidsKg > 0) {
        const prixMoyen = ss.totalMontant / ss.totalPoidsKg;
        insights.ventes.push(
          `Prix moyen de vente : ${Math.round(prixMoyen)} FCFA/kg.`
        );
      }

      // Poids moyen par poisson vendu
      if (ss.totalPoissonsVendus > 0) {
        const poidsMoyenVendu = (ss.totalPoidsKg / ss.totalPoissonsVendus) * 1000;
        insights.ventes.push(
          `Poids moyen par poisson vendu : ${Math.round(poidsMoyenVendu)}g.`
        );
      }
    } else {
      if (data.statut === StatutVague.EN_COURS) {
        insights.ventes.push(
          `Aucune vente enregistrée. La production est encore en phase de grossissement.`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Rentabilité
  // -------------------------------------------------------------------------

  if (data.coutProduction) {
    const cp = data.coutProduction.resume;
    if (cp.coutTotal > 0) {
      insights.rentabilite.push(
        `Coût de production total : ${fmtFCFA(cp.coutTotal)} (${fmtFCFA(cp.coutParKg)}/kg).`
      );
    }

    if (cp.prixMoyenVenteKg !== null && cp.coutParKg !== null) {
      const ratio = cp.coutParKg / cp.prixMoyenVenteKg;
      if (ratio <= 0.5) {
        insights.rentabilite.push(
          `Le coût de production ne représente que ${(ratio * 100).toFixed(0)}% du prix de vente — marge confortable.`
        );
      } else if (ratio <= 0.8) {
        insights.rentabilite.push(
          `Le coût de production représente ${(ratio * 100).toFixed(0)}% du prix de vente — marge correcte.`
        );
      } else {
        insights.rentabilite.push(
          `Le coût de production représente ${(ratio * 100).toFixed(0)}% du prix de vente — marge serrée, vigilance requise.`
        );
      }
    }

    if (cp.roi !== null) {
      if (cp.roi >= 100) {
        insights.rentabilite.push(
          `ROI de ${cp.roi.toFixed(0)}% — investissement récupéré ${(cp.roi / 100 + 1).toFixed(1)}×. Performance excellente.`
        );
      } else if (cp.roi >= 50) {
        insights.rentabilite.push(
          `ROI de ${cp.roi.toFixed(0)}% — bonne rentabilité.`
        );
      } else if (cp.roi >= 0) {
        insights.rentabilite.push(
          `ROI de ${cp.roi.toFixed(0)}% — rentable mais avec marge d'amélioration.`
        );
      } else {
        insights.rentabilite.push(
          `ROI négatif (${cp.roi.toFixed(0)}%) — la vague n'a pas couvert ses coûts.`
        );
      }
    }

    // Seuil de rentabilité
    if (cp.prixMoyenVenteKg !== null && cp.coutTotal > 0 && data.salesSummary) {
      const seuilKg = cp.coutTotal / cp.prixMoyenVenteKg;
      if (data.salesSummary.totalPoidsKg >= seuilKg) {
        insights.rentabilite.push(
          `Seuil de rentabilité (${seuilKg.toFixed(0)} kg) dépassé de ${(data.salesSummary.totalPoidsKg - seuilKg).toFixed(0)} kg.`
        );
      } else if (data.salesSummary.totalPoidsKg > 0) {
        insights.rentabilite.push(
          `Seuil de rentabilité : ${seuilKg.toFixed(0)} kg. Encore ${(seuilKg - data.salesSummary.totalPoidsKg).toFixed(0)} kg à vendre pour couvrir les coûts.`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lineage (origine des poissons / cycle complet)
  // -------------------------------------------------------------------------

  if (data.lineage && data.lineage.parents.length > 0) {
    const lineage = data.lineage;
    const nbParents = lineage.parents.length;
    const dateDebutStr = fmtDate(lineage.dateDebutCycle);

    insights.executive.push(
      `Cycle complet : poissons issus de ${nbParents} vague${nbParents > 1 ? "s" : ""} de pré-grossissement, démarrage initial le ${dateDebutStr}.`
    );

    insights.lineage.push(
      `Cycle total de ${lineage.dureeTotaleCycle} jours (depuis le ${dateDebutStr}). Poids initial au départ du cycle : ${lineage.poidsInitialCycle}g/poisson.`
    );

    if (lineage.gainPoidsCumule !== null) {
      const gainCycle = lineage.gainPoidsCumule;
      const gainGrossissement = data.kpis.poidsMoyenFinal !== null
        ? data.kpis.poidsMoyenFinal - data.poidsMoyenInitial
        : null;

      if (gainGrossissement !== null) {
        insights.lineage.push(
          `Gain de poids cumulé : ${Math.round(gainCycle)}g sur ${lineage.dureeTotaleCycle} jours (vs ${Math.round(gainGrossissement)}g depuis le grossissement seul sur ${dureeJours} jours).`
        );
      } else {
        insights.lineage.push(
          `Gain de poids cumulé depuis le début du cycle : ${Math.round(gainCycle)}g.`
        );
      }
    }

    // Mortalité au transfert
    const totalMortsTransfert = lineage.parents.reduce((sum, p) => sum + p.nombreMorts, 0);
    if (totalMortsTransfert > 0) {
      const totalTransferes = lineage.parents.reduce((sum, p) => sum + p.nombrePoissons, 0);
      const tauxPerte = totalTransferes > 0
        ? ((totalMortsTransfert / (totalTransferes + totalMortsTransfert)) * 100).toFixed(1)
        : "0";
      insights.lineage.push(
        `Pertes au(x) transfert(s) : ${totalMortsTransfert} poissons (${tauxPerte}% des poissons manipulés).`
      );
    }

    // Insight rentabilité cycle complet si coût disponible
    if (data.coutProduction && lineage.gainPoidsCumule !== null) {
      const cp = data.coutProduction.resume;
      if (cp.coutParKg !== null) {
        insights.lineage.push(
          `Coût de revient du cycle complet : ${fmtFCFA(cp.coutParKg)}/kg (basé sur ${lineage.dureeTotaleCycle} jours de production totale).`
        );
      }
    }
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtFCFA(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M FCFA`;
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + s + " FCFA";
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
