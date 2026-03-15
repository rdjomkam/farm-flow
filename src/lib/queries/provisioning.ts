/**
 * provisioning.ts — Logique transactionnelle pour l'activation d'un Pack.
 *
 * Lors de l'activation, une seule transaction Prisma crée :
 * 1. Le site client
 * 2. Les SiteRoles système pour le site client
 * 3. L'utilisateur client avec son SiteMember (PISCICULTEUR)
 * 4. Le system user DKFarm ajouté comme ADMIN du site client
 * 5. Une copie de la ConfigElevage du pack vers le site client
 * 6. Une vague pré-configurée
 * 7. Un bac initial (volume=null, EC-2.4)
 * 8. Les produits copiés vers le stock client (F-14)
 * 9. Les mouvements stock ENTREE pour chaque produit copié
 * 10. La PackActivation avec code ACT-YYYY-NNN (EC-2.5)
 *
 * Adresse : EC-2.3 (atomicité), F-03 (system user), F-04 (siteId/clientSiteId),
 *           F-05 (pas d'@unique sur clientSiteId), F-14 (copier produits), EC-2.1 (anti-double-activation)
 */

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { SYSTEM_ROLE_DEFINITIONS } from "@/lib/permissions-constants";
import type { ActivatePackDTO, ProvisioningPayload } from "@/types";
import { StatutVague, TypeMouvement, StatutActivation } from "@/types";

// Le type du client transactionnel Prisma (sans les methodes de top-niveau)
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Genere le code d'activation ACT-YYYY-NNN avec gestion de l'overflow (EC-2.5).
 * Utilise un compteur par annee, padded sur 3 digits.
 * Si > 999, utilise 4 digits (ACT-2026-1000).
 */
async function generateActivationCode(tx: TxClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ACT-${year}-`;

  const count = await tx.packActivation.count({
    where: { code: { startsWith: prefix } },
  });

  const seq = count + 1;
  // EC-2.5 : gestion overflow — si > 999, utilise le nombre tel quel
  const paddedSeq = seq <= 999 ? String(seq).padStart(3, "0") : String(seq);
  return `${prefix}${paddedSeq}`;
}

/**
 * Verifie si une activation existe deja pour ce pack + site vendeur + meme client (EC-2.1).
 * On verifie par email ou phone de l'utilisateur client demande.
 */
async function checkDoubleActivation(
  tx: TxClient,
  packId: string,
  clientPhone: string
): Promise<boolean> {
  // Chercher un user avec ce phone parmi les membres des sites clients
  const existingUser = await tx.user.findFirst({
    where: { phone: clientPhone, isSystem: false },
  });
  if (!existingUser) return false;

  // Verifier si cet utilisateur a deja une activation pour ce pack
  const existingActivation = await tx.packActivation.findFirst({
    where: {
      packId,
      clientSite: {
        members: {
          some: { userId: existingUser.id },
        },
      },
      statut: "ACTIVE",
    },
  });

  return existingActivation !== null;
}

/**
 * Trouve le system user d'un site (userId pour les entites auto-generees — F-03).
 * Retourne l'ID du system user ou l'ID du premier admin si pas de system user.
 */
async function getSystemUserId(tx: TxClient, siteId?: string): Promise<string> {
  // Chercher un system user global
  const systemUser = await tx.user.findFirst({
    where: { isSystem: true },
  });
  if (systemUser) return systemUser.id;

  // Fallback : premier admin du site
  if (siteId) {
    const member = await tx.siteMember.findFirst({
      where: {
        siteId,
        siteRole: {
          name: "Administrateur",
        },
      },
      include: { user: true },
    });
    if (member) return member.userId;
  }

  throw new Error(
    "Aucun system user trouve. Veuillez executer le seed ou creer le system user."
  );
}

/**
 * Active un Pack pour un nouveau client — crée toutes les entités en une transaction.
 *
 * @param packId - ID du pack a activer
 * @param vendeurSiteId - ID du site DKFarm vendeur (R8)
 * @param activateurUserId - ID de l'ingenieur/admin qui active
 * @param dto - Données du client a creer
 * @returns ProvisioningPayload — résumé des entités créées
 */
export async function activerPack(
  packId: string,
  vendeurSiteId: string,
  activateurUserId: string,
  dto: ActivatePackDTO
): Promise<ProvisioningPayload> {
  return prisma.$transaction(async (tx) => {
    // ──────────────────────────────────────────
    // 0. Verifications pre-transaction
    // ──────────────────────────────────────────

    // Verifier que le pack existe et est actif
    const pack = await tx.pack.findFirst({
      where: { id: packId, siteId: vendeurSiteId, isActive: true },
      include: {
        produits: {
          include: { produit: true },
        },
        configElevage: true,
      },
    });
    if (!pack) {
      throw new Error("Pack introuvable ou inactif.");
    }

    // EC-2.1 : verifier qu'il n'existe pas deja une activation pour ce client/pack
    const alreadyActivated = await checkDoubleActivation(tx, packId, dto.clientUserPhone);
    if (alreadyActivated) {
      throw new Error(
        "Ce client a deja une activation active pour ce pack."
      );
    }

    // ──────────────────────────────────────────
    // 1. Creer le site client
    // ──────────────────────────────────────────
    const clientSite = await tx.site.create({
      data: {
        name: dto.clientSiteName,
        address: dto.clientSiteAddress ?? null,
        isActive: true,
      },
    });

    // Creer les roles systeme pour le site client
    const roles = await Promise.all(
      SYSTEM_ROLE_DEFINITIONS.map((def) =>
        tx.siteRole.create({
          data: {
            name: def.name,
            description: def.description,
            permissions: [...def.permissions],
            isSystem: true,
            siteId: clientSite.id,
          },
        })
      )
    );

    const adminRole = roles.find((r) => r.name === "Administrateur");
    const pisciculteurRole = roles.find((r) => r.name === "Pisciculteur");

    if (!adminRole || !pisciculteurRole) {
      throw new Error("Roles systeme introuvables apres creation du site client.");
    }

    // ──────────────────────────────────────────
    // 2. Creer l'utilisateur client
    // ──────────────────────────────────────────
    const passwordHash = await hashPassword(dto.clientUserPassword);
    const clientUser = await tx.user.create({
      data: {
        name: dto.clientUserName,
        phone: dto.clientUserPhone,
        email: dto.clientUserEmail ?? null,
        passwordHash,
        role: "PISCICULTEUR",
        isActive: true,
        isSystem: false,
      },
    });

    // Assigner le client comme PISCICULTEUR du site client
    await tx.siteMember.create({
      data: {
        userId: clientUser.id,
        siteId: clientSite.id,
        siteRoleId: pisciculteurRole.id,
      },
    });

    // F-03 : Ajouter le system user DKFarm comme ADMIN du site client
    const systemUserId = await getSystemUserId(tx, vendeurSiteId);
    await tx.siteMember.create({
      data: {
        userId: systemUserId,
        siteId: clientSite.id,
        siteRoleId: adminRole.id,
      },
    });

    // ──────────────────────────────────────────
    // 3. Copier la ConfigElevage vers le site client (EC-5.8)
    // ──────────────────────────────────────────
    let configElevageClientId: string | null = null;

    if (pack.configElevage) {
      const config = pack.configElevage;
      const configCopie = await tx.configElevage.create({
        data: {
          nom: config.nom,
          description: config.description,
          poidsObjectif: config.poidsObjectif,
          dureeEstimeeCycle: config.dureeEstimeeCycle,
          tauxSurvieObjectif: config.tauxSurvieObjectif,
          seuilAcclimatation: config.seuilAcclimatation,
          seuilCroissanceDebut: config.seuilCroissanceDebut,
          seuilJuvenile: config.seuilJuvenile,
          seuilGrossissement: config.seuilGrossissement,
          seuilFinition: config.seuilFinition,
          alimentTailleConfig: config.alimentTailleConfig as object,
          alimentTauxConfig: config.alimentTauxConfig as object,
          fcrExcellentMax: config.fcrExcellentMax,
          fcrBonMax: config.fcrBonMax,
          fcrAcceptableMax: config.fcrAcceptableMax,
          sgrExcellentMin: config.sgrExcellentMin,
          sgrBonMin: config.sgrBonMin,
          sgrAcceptableMin: config.sgrAcceptableMin,
          survieExcellentMin: config.survieExcellentMin,
          survieBonMin: config.survieBonMin,
          survieAcceptableMin: config.survieAcceptableMin,
          densiteExcellentMax: config.densiteExcellentMax,
          densiteBonMax: config.densiteBonMax,
          densiteAcceptableMax: config.densiteAcceptableMax,
          mortaliteExcellentMax: config.mortaliteExcellentMax,
          mortaliteBonMax: config.mortaliteBonMax,
          mortaliteAcceptableMax: config.mortaliteAcceptableMax,
          phMin: config.phMin,
          phMax: config.phMax,
          phOptimalMin: config.phOptimalMin,
          phOptimalMax: config.phOptimalMax,
          temperatureMin: config.temperatureMin,
          temperatureMax: config.temperatureMax,
          temperatureOptimalMin: config.temperatureOptimalMin,
          temperatureOptimalMax: config.temperatureOptimalMax,
          oxygeneMin: config.oxygeneMin,
          oxygeneAlerte: config.oxygeneAlerte,
          oxygeneOptimal: config.oxygeneOptimal,
          ammoniacMax: config.ammoniacMax,
          ammoniacAlerte: config.ammoniacAlerte,
          ammoniacOptimal: config.ammoniacOptimal,
          nitriteMax: config.nitriteMax,
          nitriteAlerte: config.nitriteAlerte,
          mortaliteQuotidienneAlerte: config.mortaliteQuotidienneAlerte,
          mortaliteQuotidienneCritique: config.mortaliteQuotidienneCritique,
          fcrAlerteMax: config.fcrAlerteMax,
          stockJoursAlerte: config.stockJoursAlerte,
          triPoidsMin: config.triPoidsMin,
          triPoidsMax: config.triPoidsMax,
          triIntervalleJours: config.triIntervalleJours,
          biometrieIntervalleDebut: config.biometrieIntervalleDebut,
          biometrieIntervalleFin: config.biometrieIntervalleFin,
          biometrieEchantillonPct: config.biometrieEchantillonPct,
          eauChangementPct: config.eauChangementPct,
          eauChangementIntervalleJours: config.eauChangementIntervalleJours,
          densiteMaxPoissonsM3: config.densiteMaxPoissonsM3,
          densiteOptimalePoissonsM3: config.densiteOptimalePoissonsM3,
          recoltePartiellePoidsSeuil: config.recoltePartiellePoidsSeuil,
          recolteJeuneAvantJours: config.recolteJeuneAvantJours,
          isDefault: true, // Copie devient le default du site client
          isActive: true,
          siteId: clientSite.id,
        },
      });
      configElevageClientId = configCopie.id;
    }

    // ──────────────────────────────────────────
    // 4. Creer la vague pré-configurée
    // ──────────────────────────────────────────
    const today = new Date();
    const vagueCode = `VAG-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${clientSite.id.substring(0, 6).toUpperCase()}`;

    // PackActivation n'existe pas encore, on la crée après la vague
    // On la met à jour ensuite avec packActivationId
    const vague = await tx.vague.create({
      data: {
        code: vagueCode,
        dateDebut: today,
        nombreInitial: pack.nombreAlevins,
        poidsMoyenInitial: pack.poidsMoyenInitial,
        origineAlevins: `Pack ${pack.nom}`,
        statut: StatutVague.EN_COURS,
        siteId: clientSite.id,
        configElevageId: configElevageClientId,
      },
    });

    // ──────────────────────────────────────────
    // 5. Creer un bac initial (volume=null — EC-2.4)
    // ──────────────────────────────────────────
    await tx.bac.create({
      data: {
        nom: "Bac 1",
        volume: null, // Le client renseignera le volume (EC-2.4)
        vagueId: vague.id,
        siteId: clientSite.id,
      },
    });

    // ──────────────────────────────────────────
    // 6. Copier les produits vers le stock client (F-14)
    // ──────────────────────────────────────────
    const produitsCopies: { id: string; nom: string; quantite: number }[] = [];

    for (const packProduit of pack.produits) {
      const produitSource = packProduit.produit;

      // F-14 : copier les Produit (pas juste référencer), fournisseurId=null
      const produitCopie = await tx.produit.create({
        data: {
          nom: produitSource.nom,
          categorie: produitSource.categorie,
          unite: produitSource.unite,
          uniteAchat: produitSource.uniteAchat,
          contenance: produitSource.contenance,
          prixUnitaire: produitSource.prixUnitaire,
          stockActuel: packProduit.quantite, // Stock initial = quantité du pack
          seuilAlerte: produitSource.seuilAlerte,
          fournisseurId: null, // F-14 : pas de fournisseur pour les copies
          isActive: true,
          siteId: clientSite.id,
        },
      });

      produitsCopies.push({
        id: produitCopie.id,
        nom: produitCopie.nom,
        quantite: packProduit.quantite,
      });
    }

    // ──────────────────────────────────────────
    // 7. Creer les mouvements stock ENTREE
    // ──────────────────────────────────────────
    const mouvementsData = produitsCopies.map((p) => ({
      produitId: p.id,
      type: TypeMouvement.ENTREE,
      quantite: p.quantite,
      prixTotal: null,
      vagueId: vague.id,
      notes: `Stock initial — Pack ${pack.nom}`,
      userId: systemUserId,
      date: today,
      siteId: clientSite.id,
    }));

    await tx.mouvementStock.createMany({ data: mouvementsData });

    // ──────────────────────────────────────────
    // 8. Creer la PackActivation avec code unique
    // ──────────────────────────────────────────
    const code = await generateActivationCode(tx);

    const activation = await tx.packActivation.create({
      data: {
        code,
        packId: pack.id,
        userId: activateurUserId,
        siteId: vendeurSiteId,
        clientSiteId: clientSite.id,
        statut: "ACTIVE",
        dateActivation: today,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : null,
        notes: dto.notes ?? null,
      },
    });

    // ──────────────────────────────────────────
    // 9. Lier la vague a la PackActivation
    // ──────────────────────────────────────────
    await tx.vague.update({
      where: { id: vague.id },
      data: { packActivationId: activation.id },
    });

    // ──────────────────────────────────────────
    // Retourner le payload de provisioning
    // ──────────────────────────────────────────
    return {
      site: { id: clientSite.id, name: clientSite.name },
      user: { id: clientUser.id, name: clientUser.name, phone: clientUser.phone ?? "" },
      vague: { id: vague.id, code: vague.code, nombreInitial: vague.nombreInitial },
      nombreProduitsInitialises: produitsCopies.length,
      nombreMouvements: mouvementsData.length,
      activation: {
        id: activation.id,
        code: activation.code,
        statut: activation.statut as StatutActivation,
      },
    };
  });
}
