/**
 * src/lib/queries/previsions-vagues-couts-reels.ts
 *
 * Queries Prisma — couche de LECTURE du reel PAR VAGUE, pour la vue "par
 * vague" du rapprochement prevu/reel (Sprint PR3, story PR3.7, ADR-053
 * section 15, §6.4 des exigences fonctionnelles).
 *
 * ROLE STRICT DE CE FICHIER : charger, pour un ensemble de Vague REELLES
 * deja liees (`Vague.vaguePrevueId` non null), le cout complet reel
 * (`Depense.montantTotal` ou `Depense.vagueId` pointe la vague) et le
 * revenu + tonnage reel (`Vente.montantTotal`/`Vente.poidsTotalKg` ou
 * `Vente.vagueId` pointe la vague) — SELECT/agregation en base uniquement,
 * AUCUNE ecriture. La composition (ecarts, sens, couleur) vit exclusivement
 * dans `src/lib/previsions/rapprochement-vagues.ts` (moteur pur) —
 * ce fichier ne recalcule rien, il charge et retourne des agregats bruts.
 *
 * INTERDICTION ABSOLUE (ADR-053 section 5.1(a), rappelee section 15.6
 * dernier paragraphe) : ce module N'ECRIT JAMAIS dans `Depense`, `Vente`
 * ni aucune table du domaine reel.
 *
 * R8 : `siteId` filtre sur chaque requete.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { Decimal } from "@/lib/previsions/decimal-config";
import type { VagueReelleAgregat } from "@/lib/previsions/rapprochement-vagues";

interface LigneAggDepenseVague {
  vagueId: string;
  montant: string;
}

interface LigneAggVenteVague {
  vagueId: string;
  montant: string;
  poids: string;
}

/**
 * Charge le cout/revenu/tonnage reel de chaque Vague reelle demandee
 * (`vagueIds`), et l'associe a son `code` — retourne une Map indexee sur
 * l'id de la Vague reelle (jamais l'id de la VaguePrevue, cle differente,
 * cf. `construireVueParVague`). Une Vague sans AUCUNE Depense/Vente
 * enregistree apparait quand meme dans la Map, avec des totaux a 0 — c'est
 * une donnee legitime ("rien depense/vendu sur cette vague a ce jour"),
 * distincte d'une vague non realisee (absente de la Map cote appelant,
 * cf. ADR-053 §15.1 pour la distinction equivalente au niveau ligne).
 *
 * `vagueIds` vide -> Map vide, aucune requete emise.
 */
export async function getCoutsReelsParVagues(
  siteId: string,
  vagueIds: string[]
): Promise<Map<string, VagueReelleAgregat>> {
  const resultat = new Map<string, VagueReelleAgregat>();
  if (vagueIds.length === 0) return resultat;

  const vagues = await prisma.vague.findMany({
    where: { id: { in: vagueIds }, siteId },
    select: { id: true, code: true },
  });

  for (const v of vagues) {
    resultat.set(v.id, {
      vagueId: v.id,
      codeReel: v.code,
      coutReelFCFA: new Decimal(0),
      revenuReelFCFA: new Decimal(0),
      poidsReelKg: new Decimal(0),
    });
  }

  const idsPresents = vagues.map((v) => v.id);
  if (idsPresents.length === 0) return resultat;

  const [depenses, ventes] = await Promise.all([
    prisma.$queryRaw<LigneAggDepenseVague[]>`
      SELECT "vagueId" AS "vagueId", SUM("montantTotal")::text AS montant
      FROM "Depense"
      WHERE "siteId" = ${siteId} AND "vagueId" IN (${Prisma.join(idsPresents)})
      GROUP BY "vagueId"
    `,
    prisma.$queryRaw<LigneAggVenteVague[]>`
      SELECT "vagueId" AS "vagueId", SUM("montantTotal")::text AS montant, SUM("poidsTotalKg")::text AS poids
      FROM "Vente"
      WHERE "siteId" = ${siteId} AND "vagueId" IN (${Prisma.join(idsPresents)})
      GROUP BY "vagueId"
    `,
  ]);

  for (const d of depenses) {
    const agg = resultat.get(d.vagueId);
    if (agg) agg.coutReelFCFA = new Decimal(d.montant ?? "0");
  }
  for (const v of ventes) {
    const agg = resultat.get(v.vagueId);
    if (agg) {
      agg.revenuReelFCFA = new Decimal(v.montant ?? "0");
      agg.poidsReelKg = new Decimal(v.poids ?? "0");
    }
  }

  return resultat;
}
