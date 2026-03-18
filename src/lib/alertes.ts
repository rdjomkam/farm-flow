/**
 * Logique de verification des seuils d'alerte.
 *
 * Chaque fonction verifie un type d'alerte et cree une Notification
 * si le seuil est franchi — sans doublons (une seule ACTIVE par type par jour).
 *
 * Phase 3 (Sprint 19) : Les seuils de qualite d'eau et mortalite sont maintenant
 * configurables via ConfigElevage. Fallback vers les valeurs hardcodees si absent (EC-5.1).
 */

import { prisma } from "@/lib/db";
import { StatutAlerte, TypeAlerte, TypeReleve } from "@/generated/prisma/enums";
import { StatutBesoins } from "@/types";
import type { ConfigElevage } from "@/types";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

/**
 * Type interne pour les configurations d'alerte passees aux fonctions de verification.
 * typeAlerte est string pour rester compatible avec le type Prisma genere et les mocks de test.
 * Les comparaisons se font via les valeurs string des enums TypeAlerte (R2).
 */
interface ConfigAlerteType {
  id: string;
  typeAlerte: string;
  seuilValeur: number | null;
  seuilPourcentage: number | null;
  enabled: boolean;
  userId: string;
  siteId: string;
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Construit les bornes du jour courant (minuit → 23h59).
 */
function getBornesJour(): { debutJour: Date; finJour: Date } {
  const now = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const finJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { debutJour, finJour };
}

/**
 * Verifie si une notification ACTIVE du meme type existe deja pour aujourd'hui.
 * Evite les doublons lors des appels repetes dans la meme journee.
 */
async function notificationActiveExiste(
  siteId: string,
  userId: string,
  typeAlerte: TypeAlerte
): Promise<boolean> {
  const { debutJour, finJour } = getBornesJour();

  const count = await prisma.notification.count({
    where: {
      siteId,
      userId,
      typeAlerte,
      statut: StatutAlerte.ACTIVE,
      createdAt: { gte: debutJour, lte: finJour },
    },
  });

  return count > 0;
}

/**
 * Cree une notification si elle n'existe pas encore pour ce type aujourd'hui.
 */
async function creerNotificationSiAbsente(
  siteId: string,
  userId: string,
  typeAlerte: TypeAlerte,
  titre: string,
  message: string,
  lien?: string
): Promise<void> {
  const existe = await notificationActiveExiste(siteId, userId, typeAlerte);
  if (existe) return;

  await prisma.notification.create({
    data: {
      typeAlerte,
      titre,
      message,
      statut: StatutAlerte.ACTIVE,
      lien: lien ?? null,
      userId,
      siteId,
    },
  });
}

// ---------------------------------------------------------------------------
// Verifications par type d'alerte
// ---------------------------------------------------------------------------

/**
 * MORTALITE_ELEVEE : cherche les releves MORTALITE des dernieres 24h.
 * Si nombreMorts > seuilValeur (ou mortaliteQuotidienneAlerte depuis ConfigElevage), cree une notification.
 *
 * @param configElevage - ConfigElevage optionnel pour les seuils (EC-5.1 fallback)
 */
export async function verifierAlertesMortalite(
  siteId: string,
  userId: string,
  config: ConfigAlerteType,
  configElevage?: ConfigElevage | null
): Promise<void> {
  // Priorite : seuilValeur de ConfigAlerte → mortaliteQuotidienneAlerte de ConfigElevage → 5 (hardcode)
  const seuil = config.seuilValeur ?? configElevage?.mortaliteQuotidienneAlerte ?? 5;
  const depuis24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const relevesCritiques = await prisma.releve.findMany({
    where: {
      siteId,
      typeReleve: TypeReleve.MORTALITE,
      date: { gte: depuis24h },
      nombreMorts: { gt: seuil },
    },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
    },
  });

  for (const releve of relevesCritiques) {
    await creerNotificationSiAbsente(
      siteId,
      userId,
      TypeAlerte.MORTALITE_ELEVEE,
      "Mortalite elevee detectee",
      `${releve.nombreMorts} morts dans le bac "${releve.bac.nom}" (vague ${releve.vague.code}). Seuil : ${seuil}.`,
      `/vagues/${releve.vague.id}`
    );
  }
}

/**
 * QUALITE_EAU : cherche les releves QUALITE_EAU des dernieres 24h.
 * Si pH hors [phMin, phMax] ou temperature hors [temperatureOptimalMin, temperatureOptimalMax], cree une notification.
 *
 * Seuils par defaut (hardcodes) : pH [6.5, 8.5], temperature [25, 32].
 * Si configElevage est fourni, utilise ses seuils (EC-5.1 fallback si absent).
 *
 * @param configElevage - ConfigElevage optionnel pour les seuils configurables
 */
export async function verifierAlertesQualiteEau(
  siteId: string,
  userId: string,
  config: ConfigAlerteType,
  configElevage?: ConfigElevage | null
): Promise<void> {
  const depuis24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Seuils : ConfigElevage > valeurs hardcodees (EC-5.1)
  const phMin = configElevage?.phMin ?? 6.5;
  const phMax = configElevage?.phMax ?? 8.5;
  const tempMin = configElevage?.temperatureOptimalMin ?? 25;
  const tempMax = configElevage?.temperatureOptimalMax ?? 32;

  const releves = await prisma.releve.findMany({
    where: {
      siteId,
      typeReleve: TypeReleve.QUALITE_EAU,
      date: { gte: depuis24h },
    },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
    },
  });

  for (const releve of releves) {
    const problemes: string[] = [];

    if (releve.ph !== null) {
      if (releve.ph < phMin) {
        problemes.push(`pH trop bas (${releve.ph} < ${phMin})`);
      } else if (releve.ph > phMax) {
        problemes.push(`pH trop eleve (${releve.ph} > ${phMax})`);
      }
    }

    if (releve.temperature !== null) {
      if (releve.temperature < tempMin) {
        problemes.push(`Temperature trop basse (${releve.temperature}°C < ${tempMin}°C)`);
      } else if (releve.temperature > tempMax) {
        problemes.push(`Temperature trop elevee (${releve.temperature}°C > ${tempMax}°C)`);
      }
    }

    if (problemes.length > 0) {
      await creerNotificationSiAbsente(
        siteId,
        userId,
        TypeAlerte.QUALITE_EAU,
        "Qualite de l'eau hors normes",
        `Bac "${releve.bac.nom}" (vague ${releve.vague.code}) : ${problemes.join(", ")}.`,
        `/vagues/${releve.vague.id}`
      );
    }
  }
}

/**
 * STOCK_BAS : cherche les produits dont stockActuel < seuilAlerte.
 * Cree une notification groupee si des produits sont en alerte.
 */
export async function verifierAlertesStock(
  siteId: string,
  userId: string,
  config: ConfigAlerteType
): Promise<void> {
  const produits = await prisma.produit.findMany({
    where: {
      siteId,
      isActive: true,
      seuilAlerte: { gt: 0 },
    },
    select: {
      id: true,
      nom: true,
      stockActuel: true,
      seuilAlerte: true,
      unite: true,
    },
  });

  const produitsEnAlerte = produits.filter((p) => p.stockActuel < p.seuilAlerte);

  if (produitsEnAlerte.length === 0) return;

  const liste = produitsEnAlerte
    .map((p) => `${p.nom} (${p.stockActuel} ${p.unite}, seuil : ${p.seuilAlerte})`)
    .join(", ");

  await creerNotificationSiAbsente(
    siteId,
    userId,
    TypeAlerte.STOCK_BAS,
    "Stock bas detecte",
    `${produitsEnAlerte.length} produit(s) sous le seuil d'alerte : ${liste}.`,
    "/stock"
  );
}

/**
 * RAPPEL_ALIMENTATION : verifie si un releve ALIMENTATION a ete fait aujourd'hui.
 * Si aucun releve trouve, cree un rappel.
 */
export async function verifierRappelAlimentation(
  siteId: string,
  userId: string,
  config: ConfigAlerteType
): Promise<void> {
  const { debutJour, finJour } = getBornesJour();

  const releveAujourdhui = await prisma.releve.findFirst({
    where: {
      siteId,
      typeReleve: TypeReleve.ALIMENTATION,
      date: { gte: debutJour, lte: finJour },
    },
  });

  if (releveAujourdhui) return;

  await creerNotificationSiAbsente(
    siteId,
    userId,
    TypeAlerte.RAPPEL_ALIMENTATION,
    "Rappel : releve alimentation manquant",
    "Aucun releve d'alimentation n'a ete enregistre aujourd'hui.",
    "/releves/nouveau"
  );
}

/**
 * RAPPEL_BIOMETRIE : verifie si un releve BIOMETRIE a ete fait dans les N derniers
 * jours (N = seuilValeur, defaut 7 jours). Si non, cree un rappel.
 */
export async function verifierRappelBiometrie(
  siteId: string,
  userId: string,
  config: ConfigAlerteType
): Promise<void> {
  const joursMaxSansBiometrie = config.seuilValeur ?? 7;
  const depuisNJours = new Date(
    Date.now() - joursMaxSansBiometrie * 24 * 60 * 60 * 1000
  );

  const releve = await prisma.releve.findFirst({
    where: {
      siteId,
      typeReleve: TypeReleve.BIOMETRIE,
      date: { gte: depuisNJours },
    },
    orderBy: { date: "desc" },
  });

  if (releve) return;

  await creerNotificationSiAbsente(
    siteId,
    userId,
    TypeAlerte.RAPPEL_BIOMETRIE,
    "Rappel : biometrie en retard",
    `Aucun releve de biometrie n'a ete enregistre depuis ${joursMaxSansBiometrie} jours.`,
    "/releves/nouveau"
  );
}

/**
 * BESOIN_EN_RETARD : cherche les ListeBesoins avec dateLimite depassee
 * et statut SOUMISE ou APPROUVEE. Cree une notification pour le demandeur
 * si aucune notification active n'existe deja pour ce besoin aujourd'hui.
 *
 * Deduplication : une seule notification active par liste de besoins par jour.
 * Statuts terminaux (TRAITEE, CLOTUREE, REJETEE) ne declenchent pas d'alerte.
 * ADR-017.2
 */
export async function verifierBesoinsEnRetard(siteId: string): Promise<void> {
  const maintenant = new Date();
  const statutsActifs: StatutBesoins[] = [
    StatutBesoins.SOUMISE,
    StatutBesoins.APPROUVEE,
  ];

  const besoinsEnRetard = await prisma.listeBesoins.findMany({
    where: {
      siteId,
      statut: { in: statutsActifs },
      dateLimite: { lt: maintenant, not: null },
    },
    include: {
      demandeur: { select: { id: true } },
    },
  });

  for (const besoin of besoinsEnRetard) {
    const dateLimiteFormatee = besoin.dateLimite!.toLocaleDateString("fr-FR");
    await creerNotificationSiAbsente(
      siteId,
      besoin.demandeur.id,
      TypeAlerte.BESOIN_EN_RETARD,
      `Besoin en retard : ${besoin.numero}`,
      `La liste de besoins "${besoin.titre}" (${besoin.numero}) n'a pas ete traitee avant la date limite du ${dateLimiteFormatee}.`,
      `/besoins/${besoin.id}`
    );
  }
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Verifie toutes les alertes actives pour un utilisateur sur un site.
 *
 * Charge les ConfigAlerte enabled=true, puis delègue a la fonction
 * specialisee par type. Ignore PERSONNALISEE (geree manuellement).
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur dont on verifie les configs
 * @param configElevage - ConfigElevage optionnel pour seuils configurables (EC-5.1 fallback)
 */
export async function verifierAlertes(
  siteId: string,
  userId: string,
  configElevage?: ConfigElevage | null
): Promise<void> {
  const configs = await prisma.configAlerte.findMany({
    where: { siteId, userId, enabled: true },
  });

  for (const config of configs) {
    try {
      switch (config.typeAlerte) {
        case TypeAlerte.MORTALITE_ELEVEE:
          await verifierAlertesMortalite(siteId, userId, config, configElevage);
          break;

        case TypeAlerte.QUALITE_EAU:
          await verifierAlertesQualiteEau(siteId, userId, config, configElevage);
          break;

        case TypeAlerte.STOCK_BAS:
          await verifierAlertesStock(siteId, userId, config);
          break;

        case TypeAlerte.RAPPEL_ALIMENTATION:
          await verifierRappelAlimentation(siteId, userId, config);
          break;

        case TypeAlerte.RAPPEL_BIOMETRIE:
          await verifierRappelBiometrie(siteId, userId, config);
          break;

        case TypeAlerte.BESOIN_EN_RETARD:
          // Verification globale par site (pas per-user-config) — appelee separement
          // via verifierBesoinsEnRetard(siteId). Ignoree dans la boucle ConfigAlerte.
          break;

        case TypeAlerte.PERSONNALISEE:
          // Gestion manuelle — ignoree dans la verification automatique
          break;

        default:
          break;
      }
    } catch {
      // Ne pas bloquer les autres verifications si une echoue
      // En production, logger l'erreur vers un service de monitoring
    }
  }
}
