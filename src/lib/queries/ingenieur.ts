/**
 * ingenieur.ts — Queries pour le monitoring ingenieur.
 *
 * Ces queries sont utilisees par les routes /api/ingenieur/dashboard et /api/ingenieur/clients.
 * Elles permettent a l'ingenieur DKFarm de consulter en lecture seule les donnees
 * des sites clients actives via PackActivation.
 *
 * Permission requise : MONITORING_CLIENTS
 * Role concerne : INGENIEUR (lecture seule)
 */

import { prisma } from "@/lib/db";
import { StatutActivation, StatutVague, TypeReleve, StatutAlerte } from "@/types";
import {
  calculerTauxSurvie,
  calculerBiomasse,
  calculerFCR,
  computeNombreVivantsVague,
} from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Types de retour
// ---------------------------------------------------------------------------

export interface IngenieurDashboardMetrics {
  /** Nombre de PackActivation avec statut ACTIVE */
  packsActifs: number;
  /** Taux de survie moyen sur toutes les vagues EN_COURS des sites clients */
  survieMoyenne: number | null;
  /** Nombre d'alertes ACTIVE non lues sur les sites clients */
  alertesActives: number;
  /** Nombre de sites clients avec au moins une vague necessitant attention (taux survie < 80%) */
  fermesNecessitantAttention: number;
  /** Nombre total de sites clients actives */
  totalClientsActives: number;
}

export interface ClientIngenieurSummary {
  /** ID du site client */
  siteId: string;
  /** Nom du site client */
  siteName: string;
  /** Code d'activation du pack */
  activationCode: string;
  /** Statut de l'activation */
  activationStatut: StatutActivation;
  /** Date d'activation */
  dateActivation: Date;
  /** Date d'expiration (nullable) */
  dateExpiration: Date | null;
  /** Nom du pack */
  packNom: string;
  /** Nombre de vagues EN_COURS */
  vaguesEnCours: number;
  /** Taux de survie moyen des vagues actives */
  survieMoyenne: number | null;
  /** Nombre d'alertes ACTIVE non lues */
  alertesActives: number;
  /** Indique si le client necessite une attention urgente */
  necessiteAttention: boolean;
  /** Nombre de notes non lues en attente */
  notesNonLues: number;
  /** Date du dernier relevé effectué sur le site client (nullable si aucun relevé) */
  dernierReleveDate: Date | null;
}

export interface ClientsIngenieurPaginated {
  clients: ClientIngenieurSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Calcule le taux de survie moyen pour une liste de vagues EN_COURS.
 * Retourne null si aucune vague ou aucune donnee de survie disponible.
 */
function calculerSurvieMoyenneVagues(
  vagues: Array<{
    nombreInitial: number;
    bacs?: Array<{ id: string; nombreInitial: number | null }>;
    releves: Array<{
      typeReleve: string;
      nombreMorts: number | null;
      nombreCompte: number | null;
      bacId?: string | null;
    }>;
  }>
): number | null {
  const survies: number[] = [];

  for (const vague of vagues) {
    const nombreVivants = computeNombreVivantsVague(
      vague.bacs ?? [],
      vague.releves.map(r => ({ ...r, bacId: r.bacId ?? null })),
      vague.nombreInitial
    );

    const survie = calculerTauxSurvie(nombreVivants, vague.nombreInitial);
    if (survie !== null) {
      survies.push(survie);
    }
  }

  if (survies.length === 0) return null;
  const moyenne = survies.reduce((a, b) => a + b, 0) / survies.length;
  return Math.round(moyenne * 100) / 100;
}

// ---------------------------------------------------------------------------
// Queries principales
// ---------------------------------------------------------------------------

/**
 * Retourne les metriques agregees du dashboard ingenieur.
 *
 * Le vendeurSiteId est le site DKFarm de l'ingenieur (R8).
 * On cherche toutes les PackActivation dont siteId = vendeurSiteId
 * pour acceder aux sites clients.
 *
 * @param vendeurSiteId - ID du site DKFarm de l'ingenieur (R8)
 */
export async function getIngenieurDashboardMetrics(
  vendeurSiteId: string
): Promise<IngenieurDashboardMetrics> {
  // Charger toutes les activations du site vendeur avec les donnees clients
  const activations = await prisma.packActivation.findMany({
    where: { siteId: vendeurSiteId },
    include: {
      clientSite: {
        include: {
          vagues: {
            where: { statut: StatutVague.EN_COURS },
            include: {
              bacs: { select: { id: true, nombreInitial: true } },
              releves: {
                orderBy: { date: "asc" as const },
                select: {
                  typeReleve: true,
                  date: true,
                  nombreMorts: true,
                  nombreCompte: true,
                  bacId: true,
                },
              },
            },
          },
          notifications: {
            where: { statut: StatutAlerte.ACTIVE },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { dateActivation: "desc" },
  });

  // Packs actifs : activations avec statut ACTIVE
  const packsActifs = activations.filter(
    (a) => a.statut === StatutActivation.ACTIVE
  ).length;

  // Collecter toutes les vagues EN_COURS de tous les sites clients
  const toutesLesVagues = activations.flatMap((a) => a.clientSite.vagues);

  // Survie moyenne globale
  const survieMoyenne = calculerSurvieMoyenneVagues(toutesLesVagues);

  // Alertes actives : total des notifications ACTIVE non lues
  const alertesActives = activations.reduce(
    (total, a) => total + a.clientSite.notifications.length,
    0
  );

  // Fermes necessitant attention : sites avec survie < 80% sur au moins une vague active
  // ou avec des alertes actives
  const fermesNecessitantAttention = activations.filter((activation) => {
    if (activation.clientSite.vagues.length === 0) return false;

    const survieSite = calculerSurvieMoyenneVagues(activation.clientSite.vagues);
    const aAlertes = activation.clientSite.notifications.length > 0;
    const survieInsuffisante = survieSite !== null && survieSite < 80;

    return survieInsuffisante || aAlertes;
  }).length;

  // Nombre de sites clients distincts actives
  const clientSiteIds = new Set(activations.map((a) => a.clientSiteId));
  const totalClientsActives = clientSiteIds.size;

  return {
    packsActifs,
    survieMoyenne,
    alertesActives,
    fermesNecessitantAttention,
    totalClientsActives,
  };
}

/**
 * Retourne la liste paginee des clients de l'ingenieur, triee par urgence.
 *
 * Tri par urgence : clients avec alertes ou survie insuffisante en premier,
 * puis par date d'activation (les plus recentes en premier).
 *
 * @param vendeurSiteId - ID du site DKFarm de l'ingenieur (R8)
 * @param page          - Numero de page (commence a 1)
 * @param limit         - Nombre d'elements par page
 */
export async function getClientsIngenieur(
  vendeurSiteId: string,
  page: number = 1,
  limit: number = 10
): Promise<ClientsIngenieurPaginated> {
  const skip = (page - 1) * limit;

  // Charger TOUTES les activations pour pouvoir trier par urgence avant pagination
  // take: 500 comme garde-fou pour éviter une pagination sans borne (I2)
  const activations = await prisma.packActivation.findMany({
    where: { siteId: vendeurSiteId },
    take: 500,
    include: {
      pack: {
        select: { id: true, nom: true },
      },
      clientSite: {
        include: {
          vagues: {
            where: { statut: StatutVague.EN_COURS },
            select: {
              id: true,
              nombreInitial: true,
              bacs: { select: { id: true, nombreInitial: true } },
              releves: {
                orderBy: { date: "asc" as const },
                select: {
                  typeReleve: true,
                  nombreMorts: true,
                  nombreCompte: true,
                  bacId: true,
                  date: true,
                },
              },
            },
          },
          notifications: {
            where: { statut: StatutAlerte.ACTIVE },
            select: { id: true },
          },
          notesRecues: {
            where: { isRead: false },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { dateActivation: "desc" },
  });

  // Construire les summaries avec calcul d'urgence
  const summaries: (ClientIngenieurSummary & { _urgenceScore: number })[] =
    activations.map((activation) => {
      const { clientSite } = activation;

      const survieMoyenne = calculerSurvieMoyenneVagues(clientSite.vagues);
      const alertesActives = clientSite.notifications.length;
      const notesNonLues = clientSite.notesRecues.length;
      const vaguesEnCours = clientSite.vagues.length;

      // Calculer la date du dernier relevé pour indiquer l'inactivité (S2)
      const allReleves = clientSite.vagues.flatMap((v) => v.releves);
      const dernierReleveDate =
        allReleves.length > 0
          ? new Date(Math.max(...allReleves.map((r) => new Date(r.date).getTime())))
          : null;

      // Determiner si necessiteAttention : survie < 80% OU alertes actives
      const survieInsuffisante = survieMoyenne !== null && survieMoyenne < 80;
      const necessiteAttention = survieInsuffisante || alertesActives > 0;

      // Score d'urgence pour le tri (plus haut = plus urgent)
      let urgenceScore = 0;
      if (survieInsuffisante) urgenceScore += 2;
      if (alertesActives > 0) urgenceScore += 1;

      return {
        siteId: clientSite.id,
        siteName: clientSite.name,
        activationCode: activation.code,
        activationStatut: activation.statut as StatutActivation,
        dateActivation: activation.dateActivation,
        dateExpiration: activation.dateExpiration,
        packNom: activation.pack.nom,
        vaguesEnCours,
        survieMoyenne,
        alertesActives,
        necessiteAttention,
        notesNonLues,
        dernierReleveDate,
        _urgenceScore: urgenceScore,
      };
    });

  // Trier par urgence décroissante, puis par dateActivation décroissante
  summaries.sort((a, b) => {
    if (b._urgenceScore !== a._urgenceScore) {
      return b._urgenceScore - a._urgenceScore;
    }
    return b.dateActivation.getTime() - a.dateActivation.getTime();
  });

  const total = summaries.length;
  const totalPages = Math.ceil(total / limit);

  // Appliquer la pagination apres le tri
  const paginated = summaries.slice(skip, skip + limit).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ _urgenceScore, ...rest }) => rest
  );

  return {
    clients: paginated,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Retourne les details d'un site client pour l'ingenieur.
 * Verifie que le site est bien un client du vendeur (siteId).
 *
 * @param vendeurSiteId - ID du site DKFarm vendeur (R8)
 * @param clientSiteId  - ID du site client a consulter
 */
export async function getClientIngenieurDetail(
  vendeurSiteId: string,
  clientSiteId: string
): Promise<ClientIngenieurSummary | null> {
  const activation = await prisma.packActivation.findFirst({
    where: {
      siteId: vendeurSiteId,
      clientSiteId,
    },
    include: {
      pack: {
        select: { id: true, nom: true },
      },
      clientSite: {
        include: {
          vagues: {
            where: { statut: StatutVague.EN_COURS },
            select: {
              id: true,
              nombreInitial: true,
              bacs: { select: { id: true, nombreInitial: true } },
              releves: {
                orderBy: { date: "asc" as const },
                select: {
                  typeReleve: true,
                  nombreMorts: true,
                  nombreCompte: true,
                  bacId: true,
                  date: true,
                },
              },
            },
          },
          notifications: {
            where: { statut: StatutAlerte.ACTIVE },
            select: { id: true },
          },
          notesRecues: {
            where: { isRead: false },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { dateActivation: "desc" },
  });

  if (!activation) return null;

  const { clientSite } = activation;
  const survieMoyenne = calculerSurvieMoyenneVagues(clientSite.vagues);
  const alertesActives = clientSite.notifications.length;
  const notesNonLues = clientSite.notesRecues.length;

  // Calculer la date du dernier relevé pour indiquer l'inactivité (S2)
  const allReleves = clientSite.vagues.flatMap((v) => v.releves);
  const dernierReleveDate =
    allReleves.length > 0
      ? new Date(Math.max(...allReleves.map((r) => new Date(r.date).getTime())))
      : null;

  const survieInsuffisante = survieMoyenne !== null && survieMoyenne < 80;
  const necessiteAttention = survieInsuffisante || alertesActives > 0;

  return {
    siteId: clientSite.id,
    siteName: clientSite.name,
    activationCode: activation.code,
    activationStatut: activation.statut as StatutActivation,
    dateActivation: activation.dateActivation,
    dateExpiration: activation.dateExpiration,
    packNom: activation.pack.nom,
    vaguesEnCours: clientSite.vagues.length,
    survieMoyenne,
    alertesActives,
    necessiteAttention,
    notesNonLues,
    dernierReleveDate,
  };
}
