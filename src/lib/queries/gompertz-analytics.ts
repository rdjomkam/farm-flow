import { prisma } from "@/lib/db";
import { TypeReleve } from "@/types";
import { evaluerKGompertz, type GompertzKLevel } from "@/lib/benchmarks";

// ---------------------------------------------------------------------------
// Interfaces publiques
// ---------------------------------------------------------------------------

export interface KParAlimentDetailVague {
  vagueId: string;
  vagueCode: string;
  k: number;
  quantiteAliment: number;
}

export interface KParAlimentResult {
  produitId: string;
  nom: string;
  fournisseur: string | null;
  kMoyen: number;
  kNiveau: GompertzKLevel;
  nombreVagues: number;
  details: KParAlimentDetailVague[];
}

// ---------------------------------------------------------------------------
// Query principale
// ---------------------------------------------------------------------------

/**
 * Agrege le parametre K de Gompertz par aliment (produit) pour un site donne.
 *
 * Logique :
 * 1. Recupere tous les GompertzVague du site avec confidence HIGH ou MEDIUM.
 * 2. Pour chaque vague valide, recupere les ReleveConsommation (via releves ALIMENTATION).
 * 3. Groupe par produitId + vagueId pour calculer la quantite totale par vague.
 * 4. Calcule le K pondere par quantite pour chaque produit.
 * 5. Ne retourne que les produits avec >= 2 vagues de donnees.
 *
 * Pas de N+1 : une seule requete Prisma avec includes profonds.
 */
export async function getKParAliment(siteId: string): Promise<KParAlimentResult[]> {
  // Recupere tous les GompertzVague HIGH/MEDIUM du site avec les releves de consommation
  const gompertzEntries = await prisma.gompertzVague.findMany({
    where: {
      siteId,
      confidenceLevel: { in: ["HIGH", "MEDIUM"] },
    },
    select: {
      k: true,
      vagueId: true,
      vague: {
        select: {
          id: true,
          code: true,
          releves: {
            where: {
              typeReleve: TypeReleve.ALIMENTATION,
              siteId,
            },
            select: {
              consommations: {
                where: { siteId },
                select: {
                  produitId: true,
                  quantite: true,
                  produit: {
                    select: {
                      id: true,
                      nom: true,
                      fournisseur: {
                        select: { nom: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Structure intermediaire : Map<produitId, Map<vagueId, { quantite, k, vagueNom, produitNom, fournisseurNom }>>
  type VagueData = {
    k: number;
    quantite: number;
    vagueCode: string;
  };

  type ProduitData = {
    nom: string;
    fournisseur: string | null;
    vagues: Map<string, VagueData>;
  };

  const produitMap = new Map<string, ProduitData>();

  for (const entry of gompertzEntries) {
    const { k, vagueId, vague } = entry;
    const vagueCode = vague.code;

    for (const releve of vague.releves) {
      for (const conso of releve.consommations) {
        const { produitId, quantite, produit } = conso;

        if (!produitMap.has(produitId)) {
          produitMap.set(produitId, {
            nom: produit.nom,
            fournisseur: produit.fournisseur?.nom ?? null,
            vagues: new Map(),
          });
        }

        const produitData = produitMap.get(produitId)!;

        // Cumule la quantite pour ce produit dans cette vague
        const existing = produitData.vagues.get(vagueId);
        if (existing) {
          existing.quantite += quantite;
        } else {
          produitData.vagues.set(vagueId, { k, quantite, vagueCode });
        }
      }
    }
  }

  // Construit les resultats en filtrant les produits avec >= 2 vagues
  const results: KParAlimentResult[] = [];

  for (const [produitId, produitData] of produitMap.entries()) {
    const vaguesEntries = Array.from(produitData.vagues.entries());

    if (vaguesEntries.length < 2) {
      continue;
    }

    // K pondere = Σ(K_vague × quantite_vague) / Σ(quantite_vague)
    let sommeKPondere = 0;
    let sommeQuantite = 0;

    for (const [, vagueData] of vaguesEntries) {
      sommeKPondere += vagueData.k * vagueData.quantite;
      sommeQuantite += vagueData.quantite;
    }

    const kMoyen = sommeQuantite > 0 ? sommeKPondere / sommeQuantite : 0;

    const details: KParAlimentDetailVague[] = vaguesEntries.map(([vagueId, vagueData]) => ({
      vagueId,
      vagueCode: vagueData.vagueCode,
      k: vagueData.k,
      quantiteAliment: vagueData.quantite,
    }));

    results.push({
      produitId,
      nom: produitData.nom,
      fournisseur: produitData.fournisseur,
      kMoyen,
      kNiveau: evaluerKGompertz(kMoyen),
      nombreVagues: vaguesEntries.length,
      details,
    });
  }

  // Tri par kMoyen decroissant (meilleurs aliments en premier)
  results.sort((a, b) => b.kMoyen - a.kMoyen);

  return results;
}
