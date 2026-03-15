/**
 * engineer-alerts.ts — Detection et creation d'alertes automatiques vers l'ingenieur.
 *
 * Ce module analyse les vagues actives de chaque site client surveille par DKFarm
 * et cree des NoteIngenieur urgentes (visibility=INTERNE, isUrgent=true) quand
 * des seuils critiques sont atteints.
 *
 * Seuils surveilles :
 *   1. Survie < 80% (seuil ajuste via ConfigElevage.survieAcceptableMin si dispo)
 *   2. FCR > 2.2 (seuil ajuste via ConfigElevage.fcrAlerteMax si dispo)
 *   3. Inactivite > 3 jours OUVRES sans relevé (exclure samedi=6, dimanche=0)
 *   4. Stock aliment < 5 jours estimes (seuil ajuste via ConfigElevage.stockJoursAlerte)
 *
 * Anti-doublon : une alerte par type par site client par vague par jour (WAT UTC+1).
 * Verifiee en transaction via findFirst + create (R4 : atomique).
 *
 * R8 : siteId = site DKFarm de l'ingenieur dans chaque NoteIngenieur.
 */

import { prisma } from "@/lib/db";
import { VisibiliteNote, StatutVague, TypeReleve, CategorieProduit, StatutActivation } from "@/types";
import { calculerTauxSurvie, calculerFCR, calculerBiomasse } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Offset UTC+1 pour le Cameroun (WAT) en millisecondes */
const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;

/** Seuil de survie par defaut en % (alerte si taux de survie < ce seuil) */
const DEFAULT_SURVIE_SEUIL = 80;

/** Seuil FCR par defaut (alerte si FCR > ce seuil) */
const DEFAULT_FCR_SEUIL = 2.2;

/** Nombre de jours OUVRES sans releve pour declencher l'alerte d'inactivite */
const INACTIVITE_JOURS_OUVRES = 3;

/** Nombre de jours de stock aliment restant pour declencher l'alerte */
const DEFAULT_STOCK_JOURS_ALERTE = 5;

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

/** Un type d'alerte cree par ce module */
type AlerteType = "SURVIE" | "FCR" | "INACTIVITE" | "STOCK_ALIMENT";

/** Resultat du traitement des alertes pour un site */
interface EngineerAlertsResult {
  alertesCreees: number;
  alertesSautees: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/**
 * Retourne le timestamp debut de journee en WAT (UTC+1) converti en UTC.
 * Permet de detecter si une alerte a deja ete cree aujourd'hui (WAT).
 */
function getStartOfDayWAT(): Date {
  const nowWAT = new Date(Date.now() + WAT_OFFSET_MS);
  const startWAT = new Date(nowWAT);
  startWAT.setHours(0, 0, 0, 0);
  // Reconvertir en UTC pour Prisma
  return new Date(startWAT.getTime() - WAT_OFFSET_MS);
}

/**
 * Calcule le nombre de jours ouvrés (lundi-vendredi) entre une date passee et maintenant.
 *
 * @param from - Date de reference (la plus ancienne)
 * @returns Nombre de jours ouvres ecoules depuis `from`
 */
function countWorkingDaysSince(from: Date): number {
  const now = new Date();
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay(); // 0=dim, 1=lun, ..., 6=sam
    if (day !== 0 && day !== 6) {
      count++;
    }
  }

  return count;
}

/**
 * Verifie si une alerte du meme type existe deja aujourd'hui (WAT) pour ce client et cette vague.
 * Utilise le prefixe du titre pour identifier le type d'alerte (R4 : atomique).
 *
 * @param tx           - Client transactionnel Prisma
 * @param clientSiteId - Site client destinataire
 * @param vagueId      - Vague concernee
 * @param titrePrefix  - Debut du titre qui identifie le type d'alerte (ex: "[ALERTE SURVIE]")
 * @returns True si un doublon existe aujourd'hui
 */
async function hasAlerteTodayForVague(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  clientSiteId: string,
  vagueId: string,
  titrePrefix: string
): Promise<boolean> {
  const startOfDay = getStartOfDayWAT();

  const existing = await tx.noteIngenieur.findFirst({
    where: {
      clientSiteId,
      vagueId,
      titre: { startsWith: titrePrefix },
      createdAt: { gte: startOfDay },
    },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Verifie si une alerte inactivite existe deja aujourd'hui (WAT) pour ce client.
 * L'alerte inactivite n'est pas liee a une vague specifique (vagueId=null).
 *
 * @param tx           - Client transactionnel Prisma
 * @param clientSiteId - Site client destinataire
 * @param titrePrefix  - Debut du titre qui identifie le type d'alerte
 * @returns True si un doublon existe aujourd'hui
 */
async function hasAlerteTodayForSite(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  clientSiteId: string,
  titrePrefix: string
): Promise<boolean> {
  const startOfDay = getStartOfDayWAT();

  const existing = await tx.noteIngenieur.findFirst({
    where: {
      clientSiteId,
      vagueId: null,
      titre: { startsWith: titrePrefix },
      createdAt: { gte: startOfDay },
    },
    select: { id: true },
  });

  return existing !== null;
}

// ---------------------------------------------------------------------------
// Detection des alertes par type
// ---------------------------------------------------------------------------

interface AlertPayload {
  titre: string;
  contenu: string;
  vagueId: string | null;
  alerteType: AlerteType;
}

/**
 * Detecte les alertes de survie pour une vague.
 * Seuil : tauxSurvie < seuilSurvie (defaut 80%).
 */
function detectSurvieAlerte(
  vagueId: string,
  vagueCode: string,
  nombreInitial: number,
  releves: Array<{ nombreMorts?: number | null; typeReleve: string; nombreCompte?: number | null }>,
  seuilSurvie: number
): AlertPayload | null {
  const totalMortalites = releves
    .filter((r) => r.typeReleve === TypeReleve.MORTALITE)
    .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);

  const dernierComptage = releves
    .filter((r) => r.typeReleve === TypeReleve.COMPTAGE)
    .at(-1);

  const nombreVivants =
    dernierComptage?.nombreCompte != null
      ? dernierComptage.nombreCompte
      : Math.max(0, nombreInitial - totalMortalites);

  const tauxSurvie = calculerTauxSurvie(nombreVivants, nombreInitial);

  if (tauxSurvie === null || tauxSurvie >= seuilSurvie) {
    return null;
  }

  return {
    titre: `[ALERTE SURVIE] Vague ${vagueCode} — taux ${tauxSurvie.toFixed(1)}%`,
    contenu: `Le taux de survie de la vague **${vagueCode}** est de **${tauxSurvie.toFixed(1)}%**, inferieur au seuil critique de ${seuilSurvie}%.\n\n- Poissons vivants estimes : ${nombreVivants}\n- Mortalites cumulees : ${totalMortalites}\n- Nombre initial : ${nombreInitial}\n\n**Action requise :** Verifier la qualite de l'eau, identifier les causes de mortalite et envisager un traitement.`,
    vagueId,
    alerteType: "SURVIE",
  };
}

/**
 * Detecte les alertes de FCR eleve pour une vague.
 * Seuil : FCR > seuilFCR (defaut 2.2).
 */
function detectFCRAlerte(
  vagueId: string,
  vagueCode: string,
  nombreInitial: number,
  poidsMoyenInitial: number,
  releves: Array<{
    typeReleve: string;
    quantiteAliment?: number | null;
    poidsMoyen?: number | null;
    nombreMorts?: number | null;
    nombreCompte?: number | null;
  }>,
  seuilFCR: number
): AlertPayload | null {
  const alimentations = releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
  const totalAliment = alimentations.reduce((sum, r) => sum + (r.quantiteAliment ?? 0), 0);

  if (totalAliment <= 0) return null;

  const biometries = releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
  const derniereBiometrie = biometries.at(-1) ?? null;
  const poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;

  const mortalites = releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
  const totalMortalites = mortalites.reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
  const dernierComptage = releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE).at(-1);
  const nombreVivants =
    dernierComptage?.nombreCompte != null
      ? dernierComptage.nombreCompte
      : Math.max(0, nombreInitial - totalMortalites);

  const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  const biomasseInitiale = calculerBiomasse(poidsMoyenInitial, nombreInitial);

  const gainBiomasse =
    biomasse !== null && biomasseInitiale !== null ? biomasse - biomasseInitiale : null;

  const fcr = calculerFCR(totalAliment, gainBiomasse);

  if (fcr === null || fcr <= seuilFCR) {
    return null;
  }

  return {
    titre: `[ALERTE FCR] Vague ${vagueCode} — FCR ${fcr.toFixed(2)}`,
    contenu: `Le FCR (indice de conversion alimentaire) de la vague **${vagueCode}** est de **${fcr.toFixed(2)}**, superieur au seuil critique de ${seuilFCR}.\n\n- Aliment distribue total : ${totalAliment.toFixed(1)} kg\n- Gain de biomasse : ${gainBiomasse !== null ? gainBiomasse.toFixed(1) + " kg" : "non calcule"}\n\nUn FCR eleve indique une mauvaise efficacite alimentaire.\n\n**Action requise :** Verifier la qualite de l'aliment, reduire les rations de 10-15%, verifier l'absence de gaspillage.`,
    vagueId,
    alerteType: "FCR",
  };
}

/**
 * Detecte les alertes d'inactivite pour un site client.
 * Seuil : plus aucun releve depuis 3 jours OUVRES.
 * L'alerte est sur le site (vagueId=null) car plusieurs vagues peuvent etre inactives.
 */
function detectInactiviteAlerte(
  clientSiteId: string,
  dernierReleveDate: Date | null,
  nombreVaguesActives: number
): AlertPayload | null {
  if (dernierReleveDate === null) {
    // Aucun releve jamais : ne pas alerter a la creation du site
    return null;
  }

  const joursOuvresInactifs = countWorkingDaysSince(dernierReleveDate);

  if (joursOuvresInactifs < INACTIVITE_JOURS_OUVRES) {
    return null;
  }

  const dateFormatee = dernierReleveDate.toLocaleDateString("fr-FR");

  return {
    titre: `[ALERTE INACTIVITE] Site client — ${joursOuvresInactifs}j ouvrés sans relevé`,
    contenu: `Aucun releve n'a ete effectue depuis **${joursOuvresInactifs} jours ouvres** (dernier releve : ${dateFormatee}).\n\n- Vagues actives : ${nombreVaguesActives}\n\n**Action requise :** Contacter le pisciculteur pour verifier que les suivis sont bien effectues et identifier tout probleme eventuel.`,
    vagueId: null,
    alerteType: "INACTIVITE",
  };

  void clientSiteId; // silence unused param lint warning
}

/**
 * Detecte les alertes de stock bas pour un site client.
 * Seuil : stock aliment < stockJoursAlerte jours (defaut 5 jours).
 * Estimation basee sur la consommation moyenne quotidienne des 7 derniers jours.
 */
function detectStockAlimentAlerte(
  alimentsEnStock: Array<{ id: string; nom: string; stockActuel: number; categorie: string }>,
  relevesMouvements: Array<{
    date: Date;
    quantite: number;
    type: string;
  }>,
  stockJoursAlerte: number
): AlertPayload | null {
  // Filtrer les produits de type ALIMENT
  const alimentsAvecStock = alimentsEnStock.filter(
    (p) => p.categorie === CategorieProduit.ALIMENT && p.stockActuel > 0
  );

  if (alimentsAvecStock.length === 0) {
    return null;
  }

  const stockTotalKg = alimentsAvecStock.reduce((sum, p) => sum + p.stockActuel, 0);

  // Calculer la consommation moyenne sur les 7 derniers jours
  const septDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sorties7j = relevesMouvements
    .filter(
      (m) =>
        m.type === "SORTIE" &&
        new Date(m.date) >= septDaysAgo
    )
    .reduce((sum, m) => sum + m.quantite, 0);

  const consommationMoyenneJour = sorties7j / 7;

  // Si pas de consommation enregistree, on ne peut pas estimer les jours restants
  if (consommationMoyenneJour <= 0) {
    return null;
  }

  const joursEstimes = stockTotalKg / consommationMoyenneJour;

  if (joursEstimes >= stockJoursAlerte) {
    return null;
  }

  return {
    titre: `[ALERTE STOCK] Stock aliment — environ ${Math.floor(joursEstimes)}j restants`,
    contenu: `Le stock d'aliment est insuffisant : environ **${Math.floor(joursEstimes)} jours** de stock restant (seuil : ${stockJoursAlerte} jours).\n\n- Stock total aliment : ${stockTotalKg.toFixed(1)} kg\n- Consommation moyenne : ${consommationMoyenneJour.toFixed(1)} kg/jour (7 derniers jours)\n- Produits concernes : ${alimentsAvecStock.map((a) => a.nom).join(", ")}\n\n**Action requise :** Passer une commande d'approvisionnement en urgence.`,
    vagueId: null,
    alerteType: "STOCK_ALIMENT",
  };
}

// ---------------------------------------------------------------------------
// Fonction principale par site
// ---------------------------------------------------------------------------

/**
 * Analyse les indicateurs d'un site client et cree les alertes necessaires.
 *
 * @param engineerSiteId - Site DKFarm de l'ingenieur (R8 : siteId des notes)
 * @param clientSiteId   - Site client surveille
 * @param systemUserId   - ID de l'utilisateur systeme (auteur des notes)
 */
async function runAlertsForClientSite(
  engineerSiteId: string,
  clientSiteId: string,
  systemUserId: string
): Promise<EngineerAlertsResult> {
  const result: EngineerAlertsResult = {
    alertesCreees: 0,
    alertesSautees: 0,
    errors: [],
  };

  // ---- Charger les vagues actives du site client ----
  const vaguesActives = await prisma.vague.findMany({
    where: { siteId: clientSiteId, statut: StatutVague.EN_COURS },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      configElevage: {
        select: {
          fcrAlerteMax: true,
          survieAcceptableMin: true,
          stockJoursAlerte: true,
        },
      },
      releves: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          typeReleve: true,
          date: true,
          poidsMoyen: true,
          nombreMorts: true,
          quantiteAliment: true,
          nombreCompte: true,
        },
      },
    },
  });

  if (vaguesActives.length === 0) {
    return result;
  }

  // ---- Charger le stock du site client ----
  const produits = await prisma.produit.findMany({
    where: { siteId: clientSiteId, isActive: true },
    select: {
      id: true,
      nom: true,
      categorie: true,
      stockActuel: true,
    },
  });

  // ---- Charger les mouvements de stock des 7 derniers jours ----
  const septDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      siteId: clientSiteId,
      date: { gte: septDaysAgo },
    },
    select: {
      date: true,
      quantite: true,
      type: true,
    },
  });

  // ---- Trouver la date du dernier releve global (tous sites, toutes vagues) ----
  const allReleves = vaguesActives.flatMap((v) => v.releves);
  const dernierReleveDate =
    allReleves.length > 0
      ? new Date(Math.max(...allReleves.map((r) => new Date(r.date).getTime())))
      : null;

  // ---- Alertes par vague (SURVIE + FCR) ----
  for (const vague of vaguesActives) {
    // Config elevage pour les seuils
    const seuilSurvie =
      vague.configElevage?.survieAcceptableMin ?? DEFAULT_SURVIE_SEUIL;
    const seuilFCR =
      vague.configElevage?.fcrAlerteMax ?? DEFAULT_FCR_SEUIL;

    // Alerte survie
    try {
      const survieAlerte = detectSurvieAlerte(
        vague.id,
        vague.code,
        vague.nombreInitial,
        vague.releves as Array<{ nombreMorts?: number | null; typeReleve: string; nombreCompte?: number | null }>,
        seuilSurvie
      );

      if (survieAlerte) {
        await prisma.$transaction(async (tx) => {
          const isDuplicate = await hasAlerteTodayForVague(
            tx,
            clientSiteId,
            vague.id,
            "[ALERTE SURVIE]"
          );

          if (isDuplicate) {
            result.alertesSautees++;
            return;
          }

          await tx.noteIngenieur.create({
            data: {
              titre: survieAlerte.titre,
              contenu: survieAlerte.contenu,
              visibility: VisibiliteNote.INTERNE,
              isUrgent: true,
              isRead: false,
              isFromClient: false,
              ingenieurId: systemUserId,
              clientSiteId,
              vagueId: survieAlerte.vagueId,
              siteId: engineerSiteId,
            },
          });

          result.alertesCreees++;
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Alerte SURVIE vague ${vague.id}: ${msg}`);
    }

    // Alerte FCR
    try {
      const fcrAlerte = detectFCRAlerte(
        vague.id,
        vague.code,
        vague.nombreInitial,
        vague.poidsMoyenInitial,
        vague.releves as Array<{
          typeReleve: string;
          quantiteAliment?: number | null;
          poidsMoyen?: number | null;
          nombreMorts?: number | null;
          nombreCompte?: number | null;
        }>,
        seuilFCR
      );

      if (fcrAlerte) {
        await prisma.$transaction(async (tx) => {
          const isDuplicate = await hasAlerteTodayForVague(
            tx,
            clientSiteId,
            vague.id,
            "[ALERTE FCR]"
          );

          if (isDuplicate) {
            result.alertesSautees++;
            return;
          }

          await tx.noteIngenieur.create({
            data: {
              titre: fcrAlerte.titre,
              contenu: fcrAlerte.contenu,
              visibility: VisibiliteNote.INTERNE,
              isUrgent: true,
              isRead: false,
              isFromClient: false,
              ingenieurId: systemUserId,
              clientSiteId,
              vagueId: fcrAlerte.vagueId,
              siteId: engineerSiteId,
            },
          });

          result.alertesCreees++;
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Alerte FCR vague ${vague.id}: ${msg}`);
    }
  }

  // ---- Alerte inactivite (niveau site, vagueId=null) ----
  try {
    const inactiviteAlerte = detectInactiviteAlerte(
      clientSiteId,
      dernierReleveDate,
      vaguesActives.length
    );

    if (inactiviteAlerte) {
      await prisma.$transaction(async (tx) => {
        const isDuplicate = await hasAlerteTodayForSite(
          tx,
          clientSiteId,
          "[ALERTE INACTIVITE]"
        );

        if (isDuplicate) {
          result.alertesSautees++;
          return;
        }

        await tx.noteIngenieur.create({
          data: {
            titre: inactiviteAlerte.titre,
            contenu: inactiviteAlerte.contenu,
            visibility: VisibiliteNote.INTERNE,
            isUrgent: true,
            isRead: false,
            isFromClient: false,
            ingenieurId: systemUserId,
            clientSiteId,
            vagueId: null,
            siteId: engineerSiteId,
          },
        });

        result.alertesCreees++;
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Alerte INACTIVITE site client ${clientSiteId}: ${msg}`);
  }

  // ---- Alerte stock aliment (niveau site, vagueId=null) ----
  try {
    // Obtenir le seuilJoursAlerte depuis la premiere vague ayant une config
    const stockJoursAlerte =
      vaguesActives.find((v) => v.configElevage?.stockJoursAlerte != null)
        ?.configElevage?.stockJoursAlerte ?? DEFAULT_STOCK_JOURS_ALERTE;

    const stockAlerte = detectStockAlimentAlerte(
      produits as Array<{ id: string; nom: string; stockActuel: number; categorie: string }>,
      mouvements as Array<{ date: Date; quantite: number; type: string }>,
      stockJoursAlerte
    );

    if (stockAlerte) {
      await prisma.$transaction(async (tx) => {
        const isDuplicate = await hasAlerteTodayForSite(
          tx,
          clientSiteId,
          "[ALERTE STOCK]"
        );

        if (isDuplicate) {
          result.alertesSautees++;
          return;
        }

        await tx.noteIngenieur.create({
          data: {
            titre: stockAlerte.titre,
            contenu: stockAlerte.contenu,
            visibility: VisibiliteNote.INTERNE,
            isUrgent: true,
            isRead: false,
            isFromClient: false,
            ingenieurId: systemUserId,
            clientSiteId,
            vagueId: null,
            siteId: engineerSiteId,
          },
        });

        result.alertesCreees++;
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Alerte STOCK site client ${clientSiteId}: ${msg}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Point d'entree public
// ---------------------------------------------------------------------------

/**
 * Resultat global de la generation d'alertes ingenieur.
 */
export interface EngineerAlertsGlobalResult {
  alertesCreees: number;
  alertesSautees: number;
  errors: string[];
}

/**
 * Lance la detection et creation des alertes ingenieur pour un site DKFarm.
 *
 * Processus :
 *   1. Trouve tous les sites clients actifs surveilles via PackActivation.
 *   2. Pour chaque site client, calcule les indicateurs et detecte les alertes.
 *   3. Cree les NoteIngenieur urgentes (visibility=INTERNE) si besoin.
 *
 * @param engineerSiteId - Site DKFarm de l'ingenieur (siteId des notes — R8)
 * @param systemUserId   - ID de l'utilisateur systeme (auteur des notes)
 */
export async function runEngineerAlerts(
  engineerSiteId: string,
  systemUserId: string
): Promise<EngineerAlertsGlobalResult> {
  const result: EngineerAlertsGlobalResult = {
    alertesCreees: 0,
    alertesSautees: 0,
    errors: [],
  };

  // Trouver les sites clients actifs surveilles depuis ce site DKFarm
  // via les PackActivations actives
  const clientRelations = await prisma.packActivation.findMany({
    where: {
      siteId: engineerSiteId,
      statut: StatutActivation.ACTIVE,
    },
    select: {
      clientSiteId: true,
    },
  });

  // Deduplication : un meme clientSiteId peut avoir plusieurs packActivations
  const uniqueClientSiteIds = [
    ...new Set(clientRelations.map((r) => r.clientSiteId)),
  ];

  for (const clientSiteId of uniqueClientSiteIds) {
    try {
      const siteResult = await runAlertsForClientSite(
        engineerSiteId,
        clientSiteId,
        systemUserId
      );
      result.alertesCreees += siteResult.alertesCreees;
      result.alertesSautees += siteResult.alertesSautees;
      result.errors.push(...siteResult.errors);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Site client ${clientSiteId}: ${msg}`);
      console.error(`[EngineerAlerts] Erreur site client ${clientSiteId}:`, error);
    }
  }

  return result;
}
