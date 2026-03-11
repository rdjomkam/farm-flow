/**
 * Logique de verification des seuils d'alerte.
 *
 * Chaque fonction verifie un type d'alerte et cree une Notification
 * si le seuil est franchi — sans doublons (une seule ACTIVE par type par jour).
 */

import { prisma } from "@/lib/db";
import { StatutAlerte, TypeAlerte, TypeReleve } from "@/generated/prisma/enums";

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
 * Si nombreMorts > seuilValeur, cree une notification par bac concerne.
 */
export async function verifierAlertesMortalite(
  siteId: string,
  userId: string,
  config: ConfigAlerteType
): Promise<void> {
  const seuil = config.seuilValeur ?? 5;
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
 * Si pH hors [6.5, 8.5] ou temperature hors [25, 32] degres, cree une notification.
 */
export async function verifierAlertesQualiteEau(
  siteId: string,
  userId: string,
  config: ConfigAlerteType
): Promise<void> {
  const depuis24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
      if (releve.ph < 6.5) {
        problemes.push(`pH trop bas (${releve.ph} < 6.5)`);
      } else if (releve.ph > 8.5) {
        problemes.push(`pH trop eleve (${releve.ph} > 8.5)`);
      }
    }

    if (releve.temperature !== null) {
      if (releve.temperature < 25) {
        problemes.push(`Temperature trop basse (${releve.temperature}°C < 25°C)`);
      } else if (releve.temperature > 32) {
        problemes.push(`Temperature trop elevee (${releve.temperature}°C > 32°C)`);
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
 */
export async function verifierAlertes(
  siteId: string,
  userId: string
): Promise<void> {
  const configs = await prisma.configAlerte.findMany({
    where: { siteId, userId, enabled: true },
  });

  for (const config of configs) {
    try {
      switch (config.typeAlerte) {
        case TypeAlerte.MORTALITE_ELEVEE:
          await verifierAlertesMortalite(siteId, userId, config);
          break;

        case TypeAlerte.QUALITE_EAU:
          await verifierAlertesQualiteEau(siteId, userId, config);
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
