#!/usr/bin/env python3
"""
Extraction du jeu d'or du module Prévisions depuis le classeur Excel de référence.

Produit deux fixtures JSON consommées par la recette du moteur (cf. ADR-053, section 7) :

  - plan-v12-corrige.json   : le plan complet du classeur, bug `Dépenses!B10` corrigé.
  - annexe-b-corrigee.json  : la variante sans apports en capital ni investissements — le seul
                              jeu de données dont la trésorerie passe sous zéro, donc le seul qui
                              exerce la logique « point bas / besoin de financement ».

Les valeurs attendues sont lues depuis les CELLULES CALCULÉES du classeur, jamais recalculées par
une réimplémentation du moteur : la recette doit comparer le moteur applicatif à une source
indépendante de lui. La seule exception est le patch documenté ci-dessous.

    PATCH `Dépenses!B10` — Transport des alevins, août 2026
    La cellule contient un `0` en dur qui écrase la formule `=B9*Paramètres!$B$30`, alors que le
    nombre de voyages (`B9`) vaut bien 1. Le montant attendu est donc 30 000 FCFA. Ce zéro se
    propage jusqu'à la trésorerie finale. Décision actée en ADR-053 §7 : le moteur applique la
    formule partout, et les fixtures sont patchées sur cette seule cellule et ses conséquences
    arithmétiques directes.

Usage :
    python3 prisma/fixtures/previsions/extract-golden.py

Dépendance : openpyxl. Script d'outillage hors runtime applicatif — n'accède à aucune base de
données et ne lit aucune variable d'environnement (cf. R11).
"""

import json
import os
from decimal import Decimal

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
WORKBOOK = os.path.join(HERE, "Previsions_Elevage_Silure_v12.xlsx")

# Montant que `Dépenses!B10` aurait dû porter : 1 voyage × 30 000 FCFA (Paramètres!B30).
PATCH_B10 = Decimal(30000)
TAUX_EPARGNE = Decimal("0.3")
TRESORERIE_INITIALE = Decimal(0)

COLS = [chr(ord("B") + i) for i in range(21)]  # B..V — les 21 mois de l'horizon


def num(v):
    return Decimal(str(v if v is not None else 0))


def read_row(sheet, row):
    return [num(sheet[f"{c}{row}"].value) for c in COLS]


def to_json(values):
    """Sérialise en int quand la valeur est entière, sinon en float — lisible en diff git."""
    out = []
    for v in values:
        out.append(int(v) if v == v.to_integral_value() else float(v))
    return out


def cumuler(resultats, initial=TRESORERIE_INITIALE):
    treso, cur = [], initial
    for r in resultats:
        cur += r
        treso.append(cur)
    return treso


def epargner(resultats):
    return [max(Decimal(0), r) * TAUX_EPARGNE for r in resultats]


def to_num_or_none(v):
    """Comme to_json, mais sur une valeur scalaire — préserve int vs float."""
    if v is None:
        return None
    d = num(v)
    return int(d) if d == d.to_integral_value() else float(d)


def extraire_entrees_modele(wb):
    """Bloc d'ENTRÉES du moteur, lu tel quel dans les cellules de saisie du classeur — jamais
    recalculé. Alimente la feuille `Paramètres` (scénario, remises, aliments, transport), la
    feuille `Aliments` (granulométries), le plan des 19 vagues (`Empoissonnement` +
    `Aliment par vague`), et les postes de charges (`Dépenses`, lignes 14-21 et 28).

    Périmètre volontairement identique pour les deux scénarios (A et B) : ce sont les mêmes
    cellules de saisie du même classeur. La seule différence entre A et B (apports en capital et
    investissements mis à zéro) est un choix de scénario documenté par `$patch`, pas une
    divergence des données d'entrée elles-mêmes.
    """
    par, ali, emp, av, dp = (
        wb["Paramètres"],
        wb["Aliments"],
        wb["Empoissonnement"],
        wb["Aliment par vague"],
        wb["Dépenses"],
    )
    cols = COLS

    parametres_scenario = {
        "prixVenteKgFCFA": to_num_or_none(par["B5"].value),
        "poidsMoyenVenteKg": to_num_or_none(par["B6"].value),
        "partVendueFinMois2Pct": to_num_or_none(par["B7"].value),
        "partVendueMois3Pct": to_num_or_none(par["B8"].value),
        "margeSecuriteAlevinsPct": to_num_or_none(par["B11"].value),
        "prixAlevinUnitaireFCFA": to_num_or_none(par["B12"].value),
        "kgAlimentParKgPoissonInfo": to_num_or_none(par["B22"].value),
        "tauxEpargnePct": to_num_or_none(par["B36"].value),
        "tresorerieInitialeFCFA": to_num_or_none(par["B37"].value),
        "$source": "Paramètres!B5,B6,B7,B8,B11,B12,B22,B36,B37",
    }

    paliers_remise = []
    for i, row in enumerate([16, 17, 18, 19], start=1):
        paliers_remise.append(
            {
                "ordre": i,
                "seuilTonnes": to_num_or_none(par[f"B{row}"].value),
                "remisePct": to_num_or_none(par[f"C{row}"].value),
                "$source": f"Paramètres!B{row}:C{row}",
            }
        )

    transport = {
        "voyageAlimentsCapaciteSacs": to_num_or_none(par["B25"].value),
        "voyageAlimentsCoutFCFA": to_num_or_none(par["B26"].value),
        "voyagePoissonsCapaciteKg": to_num_or_none(par["B27"].value),
        "voyagePoissonsCoutFCFA": to_num_or_none(par["B28"].value),
        "voyageAlevinsCapaciteNb": to_num_or_none(par["B29"].value),
        "voyageAlevinsCoutFCFA": to_num_or_none(par["B30"].value),
        "$source": "Paramètres!B25:B30",
        "$note": (
            "Les capacités de transport sont bien saisies dans le classeur (feuille Paramètres, "
            "lignes 25-30) — elles n'ont pas besoin d'être déduites empiriquement. La capacité "
            "alevins réelle est 20 000/voyage (Paramètres!B29), pas 15 000 comme supposé "
            "empiriquement avant cette extraction."
        ),
    }

    aliments = []
    for row, gran in [(4, "2mm"), (5, "3mm"), (6, "4mm")]:
        aliments.append(
            {
                "granulometrie": gran,
                "marque": ali[f"B{row}"].value,
                "poidsSacKg": to_num_or_none(ali[f"C{row}"].value),
                "prixSacFCFA": to_num_or_none(ali[f"D{row}"].value),
                "prixKgFCFA": to_num_or_none(ali[f"E{row}"].value),
                "repartitionPctMois1": to_num_or_none(ali[f"F{row}"].value) or 0,
                "repartitionPctMois2": to_num_or_none(ali[f"G{row}"].value) or 0,
                "repartitionPctMois3": to_num_or_none(ali[f"H{row}"].value) or 0,
                "sacsParTonneStandard": to_num_or_none(ali[f"J{row}"].value),
                "$source": f"Aliments!A{row}:J{row}",
            }
        )

    plan_vagues = []
    for row in range(4, 23):
        vague = emp[f"A{row}"].value
        if vague is None:
            continue
        mois_dt = emp[f"B{row}"].value
        plan_vagues.append(
            {
                "vague": vague,
                "moisEmpoissonnement": mois_dt.strftime("%Y-%m") if mois_dt else None,
                "objectifTonnes": to_num_or_none(emp[f"C{row}"].value),
                "poissonsAVendreNb": to_num_or_none(emp[f"D{row}"].value),
                "alevinsACommanderNb": to_num_or_none(emp[f"E{row}"].value),
                "alevinsAchetes": emp[f"F{row}"].value,
                "remisePct": to_num_or_none(emp[f"G{row}"].value),
                "coutAlevinsFCFA": to_num_or_none(emp[f"H{row}"].value),
                "sacs2mm": to_num_or_none(av[f"D{row}"].value),
                "sacs3mm": to_num_or_none(av[f"E{row}"].value),
                "sacs4mm": to_num_or_none(av[f"F{row}"].value),
                "sacsTotal": to_num_or_none(av[f"J{row}"].value),
                "kgTotal": to_num_or_none(av[f"K{row}"].value),
                "coutAlimentsFCFA": to_num_or_none(av[f"L{row}"].value),
                "coutAlimentsMois1FCFA": to_num_or_none(av[f"N{row}"].value),
                "coutAlimentsMois2FCFA": to_num_or_none(av[f"O{row}"].value),
                "coutAlimentsMois3FCFA": to_num_or_none(av[f"P{row}"].value),
                "$source": f"Empoissonnement!A{row}:H{row} + 'Aliment par vague'!D{row}:P{row}",
            }
        )

    postes_charges_exploitation = []
    for row in range(14, 22):
        libelle = dp[f"A{row}"].value
        if libelle is None:
            continue
        postes_charges_exploitation.append(
            {
                "libelle": libelle,
                "valeursParMoisFCFA": [to_num_or_none(dp[f"{c}{row}"].value) or 0 for c in cols],
                "$source": f"Dépenses!A{row}, B{row}:V{row}",
            }
        )

    journal_credits = {
        "libelle": dp["A28"].value,
        "valeursParMoisFCFA": [to_num_or_none(dp[f"{c}28"].value) or 0 for c in cols],
        "$source": "Dépenses!A28, B28:V28 (ligne 'Crédits', saisie en dur)",
        "$note": (
            "Le journal des dépenses ('Journal dépenses') ne contient que 2 lignes d'exemple à "
            "0 FCFA — cette ligne 'Crédits' de Dépenses (5 valeurs non nulles) n'est adossée à "
            "aucune ligne de journal dans le classeur. Voir README, section « Cinq montants "
            "absents du jeu d'or »."
        ),
    }

    investissements_exceptionnels = {
        "libelle": dp["A33"].value,
        "valeursParMoisFCFA": [to_num_or_none(dp[f"{c}33"].value) or 0 for c in cols],
        "$source": "Dépenses!A33, B33:V33 (saisie en dur, hors coût de production)",
        "$note": (
            "Décembre 2026 (index 4) porte 16 400 000 FCFA en plus des 4 000 000 déjà comptés "
            "par la ligne Crédits — ce surplus n'a lui non plus aucune ligne de journal source "
            "dans le classeur."
        ),
    }

    donnees_manquantes = [
        "poidsMoyenInitialG (poids des alevins au stockage) : absent du classeur. Seul "
        "'Poids moyen d'un poisson à la vente' (Paramètres!B6 = 0.4 kg) existe ; aucune cellule "
        "ne porte le poids initial des alevins. Impact : le moteur ne peut pas dériver une "
        "courbe de croissance alevin→vente à partir du seul classeur ; ce paramètre devra être "
        "saisi indépendamment ou le calcul de croissance restera hors du périmètre de cette "
        "recette.",
        "poidsObjectifG en tant que paramètre nommé n'existe pas séparément : la seule cellule "
        "disponible est Paramètres!B6 ('Poids moyen d'un poisson à la vente', 0.4 kg = 400 g), "
        "réutilisée ci-dessus comme 'poidsMoyenVenteKg'.",
        "effectifAlevinsParVague en tant que constante unique du scénario : n'existe pas — "
        "l'effectif d'alevins commandés varie par vague selon son tonnage visé "
        "(Empoissonnement!E4:E22, repris ci-dessus dans planVagues[].alevinsACommanderNb). Ce "
        "n'est pas un paramètre scalaire du scénario mais une série dérivée par vague.",
        "nombreBacsSimultanesCible : absent du classeur. Aucune cellule ne fixe un nombre de "
        "bacs cible ; le classeur raisonne uniquement en tonnage par vague, jamais en nombre de "
        "bacs.",
        "frequenceStockageMois : absent en tant que paramètre nommé. Le plan des vagues "
        "(planVagues ci-dessus) montre empiriquement une cadence d'un stockage par mois (V1 en "
        "2026-08, V2 en 2026-09, ...), mais aucune cellule ne fixe cette cadence comme un "
        "paramètre — c'est une conséquence du plan saisi, pas une entrée indépendante.",
        "dureeCycleMois : absent en tant que paramètre nommé. Le cycle de 3 mois est implicite "
        "dans la structure des feuilles ('Aliment par vague', colonnes mois 1/2/3 ; 'Gantt "
        "vagues', M1/M2-ventes/M3-ventes) mais n'est écrit nulle part comme une valeur "
        "modifiable — c'est une hypothèse structurelle du classeur, pas une cellule de saisie.",
    ]

    return {
        "$description": (
            "Bloc d'ENTRÉES du moteur, lu directement dans les cellules de saisie du classeur "
            "(feuilles Paramètres, Aliments, Empoissonnement, 'Aliment par vague', Dépenses). "
            "Identique pour les deux scénarios A et B — voir le commentaire de "
            "extraire_entrees_modele() dans extract-golden.py."
        ),
        "parametresScenario": parametres_scenario,
        "paliersRemise": paliers_remise,
        "transport": transport,
        "aliments": aliments,
        "planVagues": plan_vagues,
        "chargesExploitation": postes_charges_exploitation,
        "journalDepensesPonctuelles": {
            "credits": journal_credits,
            "investissementsExceptionnels": investissements_exceptionnels,
        },
        "donneesManquantes": donnees_manquantes,
    }


def extraire_detail_par_vague(pv):
    """Bloc « DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif) » (Prévisions!A11:V23).

    Neuf séries numériques, `read_row` sur B..V comme toutes les autres séries de ce script,
    jamais recalculées :

      - lignes 13/14/15 = 1er mois de cycle, granulométries 2 mm / 3 mm / 4 mm
      - lignes 17/18/19 = 2e mois de cycle, 2 mm / 3 mm / 4 mm
      - lignes 21/22/23 = 3e mois de cycle, 2 mm / 3 mm / 4 mm

    Correspondance ligne <-> série vérifiée manuellement sur les libellés de colonne A avant
    extraction (voir rapport de test associé) — pas présumée.

    Les lignes 12/16/20 (« Vague en 1er/2e/3e mois de cycle ») portent un lookup INDEX/MATCH qui
    n'affiche qu'UNE vague même quand plusieurs coïncident le même mois — défaut bénin déjà
    documenté (ADR-053 §7, « Défaut bénin confirmé »). Elles ne sont PAS extraites comme séries
    numériques ; on ne conserve que leur valeur du mois 1 (colonne B) à titre de métadonnée
    explicitement marquée comme défectueuse, jamais consommée par le moteur.

    Ces neuf séries sont des sacs CONSOMMÉS (ROUND), pas des sacs À ACHETER (CEIL, lignes 7-10) —
    voir README, section correspondante. Elles ne sont affectées ni par le patch `Dépenses!B10`
    (une dépense en FCFA, sans rapport avec un décompte de sacs) ni par la différence entre les
    scénarios A et B (apports/investissements, eux aussi de purs montants) : identiques dans les
    deux fixtures, comme le reste de `entreesModele`.
    """
    granulometries = ["2mm", "3mm", "4mm"]
    blocs = [
        ("moisCycle1", 13, 12),
        ("moisCycle2", 17, 16),
        ("moisCycle3", 21, 20),
    ]
    detail = {
        "$description": (
            "DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif), Prévisions!A11:V23. "
            "Un ROUND (sacs consommés), pas le CEIL de 'Sacs à acheter' (lignes 7-10, sacs à "
            "commander) — voir README."
        ),
        "$source": "Prévisions!B13:V15, B17:V19, B21:V23",
    }
    for cle, row_2mm, row_label in blocs:
        row_3mm, row_4mm = row_2mm + 1, row_2mm + 2
        detail[cle] = {
            "2mm": to_json(read_row(pv, row_2mm)),
            "3mm": to_json(read_row(pv, row_3mm)),
            "4mm": to_json(read_row(pv, row_4mm)),
            "$source": f"Prévisions!B{row_2mm}:V{row_2mm}, B{row_3mm}:V{row_3mm}, B{row_4mm}:V{row_4mm}",
        }
        detail[f"{cle}VagueLabelIndexMatch"] = {
            "valeurMois1": pv[f"B{row_label}"].value,
            "$source": f"Prévisions!B{row_label}",
            "$defectueux": (
                "Lookup INDEX/MATCH — n'affiche qu'UNE vague même quand plusieurs coïncident le "
                "même mois (ADR-053 §7, « Défaut bénin confirmé »). Métadonnée d'affichage "
                "uniquement, jamais une série numérique, jamais consommée par le moteur : les "
                "quantités ci-dessus (SUMIFS) cumulent déjà correctement toutes les vagues."
            ),
        }
    return detail


def main():
    wb = openpyxl.load_workbook(WORKBOOK, data_only=True)
    pv, dp, ba = wb["Prévisions"], wb["Dépenses"], wb["Besoins aliments"]
    entrees_modele = extraire_entrees_modele(wb)
    detail_par_vague = extraire_detail_par_vague(pv)

    mois = [pv[f"{c}3"].value.strftime("%Y-%m") for c in COLS]

    # --- Grandeurs physiques et de vente : inchangées par le patch -----------------------------
    empoissonne_t = read_row(pv, 4)
    alevins_commandes = read_row(pv, 5)
    besoin_kg = read_row(pv, 6)
    sacs_total = read_row(pv, 7)
    sacs_2mm, sacs_3mm, sacs_4mm = read_row(pv, 8), read_row(pv, 9), read_row(pv, 10)
    ventes_t = read_row(pv, 24)
    chiffre_affaires = read_row(pv, 25)
    depense_aliments = read_row(pv, 28)
    depense_alevins = read_row(pv, 29)
    voyages_aliments = read_row(dp, 5)
    voyages_poissons = read_row(dp, 7)
    voyages_alevins = read_row(dp, 9)
    kg_par_granulometrie = {
        "2mm": [num(ba[f"B{5 + i}"].value) for i in range(21)],
        "3mm": [num(ba[f"C{5 + i}"].value) for i in range(21)],
        "4mm": [num(ba[f"D{5 + i}"].value) for i in range(21)],
    }

    # --- Lignes monétaires touchées par le patch B10 (août 2026 = index 0) ---------------------
    def patch(row):
        v = list(row)
        v[0] += PATCH_B10
        return v

    transport_alevins = patch(read_row(dp, 10))
    logistique = patch(read_row(dp, 11))
    charges_exploitation = read_row(dp, 22)  # saisie pure, non touchée
    base_repartition = patch(read_row(dp, 31))
    charges_operationnelles = patch(read_row(dp, 32))
    investissements = read_row(dp, 33)  # non touché
    apports_capital = read_row(pv, 26)  # saisie pure, non touchée

    # --- Scénario A : plan v12 complet, corrigé ------------------------------------------------
    autres_depenses_a = [charges_operationnelles[i] + investissements[i] for i in range(21)]
    depenses_totales_a = [
        depense_aliments[i] + depense_alevins[i] + autres_depenses_a[i] for i in range(21)
    ]
    total_entrees_a = [chiffre_affaires[i] + apports_capital[i] for i in range(21)]
    resultat_a = [total_entrees_a[i] - depenses_totales_a[i] for i in range(21)]
    tresorerie_a = cumuler(resultat_a)

    # --- Scénario B : sans apports ni investissements ------------------------------------------
    zero = [Decimal(0)] * 21
    depenses_totales_b = [
        depense_aliments[i] + depense_alevins[i] + charges_operationnelles[i] for i in range(21)
    ]
    resultat_b = [chiffre_affaires[i] - depenses_totales_b[i] for i in range(21)]
    tresorerie_b = cumuler(resultat_b)

    commun = {
        "mois": mois,
        "entreesModele": entrees_modele,
        "entrees": {
            "empoissonneT": to_json(empoissonne_t),
            "ventesT": to_json(ventes_t),
            "chiffreAffaires": to_json(chiffre_affaires),
        },
        "besoinsAliments": {
            "totalKg": to_json(besoin_kg),
            "kgParGranulometrie": {k: to_json(v) for k, v in kg_par_granulometrie.items()},
            "sacsTotal": to_json(sacs_total),
            "sacsParGranulometrie": {
                "2mm": to_json(sacs_2mm),
                "3mm": to_json(sacs_3mm),
                "4mm": to_json(sacs_4mm),
            },
            "detailParVagueSacs": detail_par_vague,
        },
        "logistique": {
            "voyagesAliments": to_json(voyages_aliments),
            "voyagesPoissons": to_json(voyages_poissons),
            "voyagesAlevins": to_json(voyages_alevins),
            "transportAlevins": to_json(transport_alevins),
            "sousTotal": to_json(logistique),
        },
        "depenses": {
            "aliments": to_json(depense_aliments),
            "alevins": to_json(depense_alevins),
            "alevinsCommandes": to_json(alevins_commandes),
            "chargesExploitation": to_json(charges_exploitation),
            "baseRepartition": to_json(base_repartition),
            "chargesOperationnelles": to_json(charges_operationnelles),
        },
    }

    scenario_a = {
        "$description": (
            "Plan v12 complet (19 vagues, août 2026 → avril 2028), avec apports en capital et "
            "investissements. Bug Dépenses!B10 corrigé : +30 000 FCFA sur août 2026."
        ),
        "$source": "Previsions_Elevage_Silure_v12.xlsx",
        "$patch": (
            "Dépenses!B10 (Transport des alevins, août 2026) : 0 en dur remplacé par 30 000 FCFA "
            "(1 voyage × 30 000). Propagé sur logistique, base de répartition, charges "
            "opérationnelles, autres dépenses, dépenses totales, résultat, épargne et trésorerie. "
            "Voir ADR-053 §7."
        ),
        **commun,
        "resultats": {
            "apportsCapital": to_json(apports_capital),
            "totalEntrees": to_json(total_entrees_a),
            "investissements": to_json(investissements),
            "autresDepenses": to_json(autres_depenses_a),
            "depensesTotales": to_json(depenses_totales_a),
            "resultat": to_json(resultat_a),
            "epargne": to_json(epargner(resultat_a)),
            "tresorerie": to_json(tresorerie_a),
        },
        "cumuls": {
            "tonnageVendu": float(sum(ventes_t)),
            "chiffreAffaires": int(sum(chiffre_affaires)),
            "apportsCapital": int(sum(apports_capital)),
            "depensesTotales": int(sum(depenses_totales_a)),
            "dontAliments": int(sum(depense_aliments)),
            "dontInvestissements": int(sum(investissements)),
            "resultatCumule": int(sum(resultat_a)),
            "tresorerieFinale": int(tresorerie_a[-1]),
            "pointBasTresorerie": int(min(tresorerie_a)),
            "moisPointBas": mois[tresorerie_a.index(min(tresorerie_a))],
            "besoinMensuelMaxKg": float(max(besoin_kg)),
        },
    }

    scenario_b = {
        "$description": (
            "Variante « annexe B corrigée » : même plan, sans apports en capital ni "
            "investissements. Seul jeu de données dont la trésorerie passe sous zéro — exerce la "
            "logique point bas / besoin de financement (exigences §7.2)."
        ),
        "$source": "Previsions_Elevage_Silure_v12.xlsx, dérivé",
        "$patch": (
            "Même correction Dépenses!B10 que le scénario principal, plus apports en capital et "
            "investissements forcés à zéro sur tout l'horizon. L'annexe B des exigences annonce "
            "308 129 600 / 149 770 400 / −6 304 704 : ces valeurs portent le bug B10, l'écart de "
            "30 000 FCFA est attendu. Voir ADR-053 §7."
        ),
        **commun,
        "resultats": {
            "apportsCapital": to_json(zero),
            "totalEntrees": to_json(chiffre_affaires),
            "investissements": to_json(zero),
            "autresDepenses": to_json(charges_operationnelles),
            "depensesTotales": to_json(depenses_totales_b),
            "resultat": to_json(resultat_b),
            "epargne": to_json(epargner(resultat_b)),
            "tresorerie": to_json(tresorerie_b),
        },
        "cumuls": {
            "tonnageVendu": float(sum(ventes_t)),
            "chiffreAffaires": int(sum(chiffre_affaires)),
            "apportsCapital": 0,
            "depensesTotales": int(sum(depenses_totales_b)),
            "dontAliments": int(sum(depense_aliments)),
            "dontInvestissements": 0,
            "resultatCumule": int(sum(resultat_b)),
            "tresorerieFinale": int(tresorerie_b[-1]),
            "pointBasTresorerie": int(min(tresorerie_b)),
            "moisPointBas": mois[tresorerie_b.index(min(tresorerie_b))],
            "besoinMensuelMaxKg": float(max(besoin_kg)),
        },
    }

    for nom, data in [
        ("plan-v12-corrige.json", scenario_a),
        ("annexe-b-corrigee.json", scenario_b),
    ]:
        with open(os.path.join(HERE, nom), "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        print(f"écrit : {nom}")
        print(f"        {json.dumps(data['cumuls'], ensure_ascii=False)}")


if __name__ == "__main__":
    main()
