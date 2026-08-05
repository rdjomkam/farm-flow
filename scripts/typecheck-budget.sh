#!/usr/bin/env bash
#
# Garde-fou de la dette `tsc --noEmit` (sprint de résorption des réserves du
# module Prévisions, réserve R6).
#
# ## Pourquoi ce script existe
# `next build` ne type-check PAS les fichiers `__tests__` (ERR-186,
# docs/knowledge/ERRORS-AND-FIXES.md) : il ne parcourt que ce qui est
# atteignable depuis les points d'entrée de l'application (pages, routes
# API). Une régression de typage dans une fixture de test peut donc rester
# invisible indéfiniment tant que personne ne relance `tsc --noEmit` sur le
# `tsconfig.json` complet. C'est exactement ce qui s'est produit : la dette
# est passée de 1 423 erreurs (review PR2-octies) à 1 449 (début de ce
# sprint) sans qu'aucune étape de CI ne le détecte — `npx vitest run`
# n'a pas besoin d'un typage correct pour exécuter les tests, et il n'y
# avait aucune étape `tsc --noEmit` dans `.github/workflows/ci.yml`.
#
# Ce sprint a fait mécaniquement baisser le compte à 178 (−87,7 %). Ce
# script fige ce chiffre comme PLAFOND — un seuil qui ne peut jamais monter
# en silence — et interdit aussi qu'il reste au-dessus du compte réel une
# fois qu'il baisse (sinon il devient un plafond mou qui ne descend jamais).
#
# ## Méthode de comptage — NE PAS CHANGER sans le documenter ici
# `npx tsc --noEmit | grep -c "error TS"` — c'est la méthode utilisée pour
# tous les chiffres cités dans ce sprint (1 423 / 1 449 / 178). La garder
# est nécessaire pour que ces chiffres restent comparables entre eux et avec
# celui-ci. Une autre méthode de comptage (ex. compter les lignes vides
# entre erreurs, ou parser le JSON de `tsc --noEmit --pretty false`)
# produirait un chiffre différent et invaliderait toute comparaison
# historique.
#
# ## .next/types
# `.next/types/**/*.ts` fait partie de l'`include` de `tsconfig.json`. La
# mesure de référence (178) a été faite avec ce dossier ABSENT (généré
# uniquement par `next build`/`next dev`, jamais par `npm ci` seul) — il
# contribuait 0 erreur au moment de la mesure, mais rien ne garantit que ce
# resterait vrai indéfiniment si le dossier existe localement (état d'un
# build précédent) alors qu'il est absent en CI (checkout propre). Pour ne
# jamais dépendre de cet état local imprévisible, ce garde-fou est placé
# dans le workflow CI **avant** l'étape de build (juste après `npm ci`) —
# voir `.github/workflows/ci.yml` job `test`, étape "Typecheck budget". À
# cet endroit, `.next/types` n'existe jamais sur un runner fraîchement
# checké-out, donc le compte mesuré en CI ne peut structurellement pas
# différer selon qu'un build a eu lieu avant ou non. Ce comportement n'a pas
# besoin d'être forcé dans ce script (ex. en supprimant `.next/types` avant
# de lancer `tsc`) : le positionnement dans le workflow suffit à le
# garantir. Un développeur qui lance ce script en local APRÈS un `npm run
# build` peut, en théorie, observer un compte légèrement différent si
# `.next/types` venait à générer une erreur de typage — dans ce cas rare,
# comparer au compte obtenu par `rm -rf .next/types && npm run typecheck:budget`
# avant de conclure à une régression réelle.
#
# ## Défaut connu de ce garde-fou — à ne jamais perdre de vue
# Ce compteur est un TOTAL AGRÉGÉ, sans distinction de gravité. Il peut
# rester parfaitement stable pendant qu'on corrige 15 erreurs triviales
# (ex. `TS6133` variable inutilisée) et qu'on en introduit 15 bien plus
# dangereuses (ex. `TS2367` comparaison d'enum toujours fausse, `TS2339`
# accès à une propriété inexistante qui reste silencieux en JS à
# l'exécution, `TS2554` mauvais nombre d'arguments) — ce sprint a trouvé 8
# exemples réels de ce type d'erreur dans la dette existante. Un total qui
# ne bouge pas ne veut donc PAS dire qu'aucune régression qualitative n'a
# eu lieu.
#
# Atténuation possible, **non livrée ici** (hors périmètre de ce
# garde-fou) : maintenir une liste de codes d'erreur « dangereux »
# (`TS2339`, `TS2367`, `TS2554`, et plus généralement tout code qui
# masque un bug silencieux en JS plutôt qu'un simple bruit de compilation)
# et interdire toute augmentation de LEUR sous-compte, y compris quand le
# total global baisse. Cette liste n'existe pas dans ce script : la
# construire nécessiterait de trier les 178 erreurs actuelles par gravité,
# ce qui dépasse le rôle de ce garde-fou (poser le compteur, pas classifier
# la dette qu'il compte). Ne pas déduire de l'existence de ce script une
# protection contre ce type de régression qualitative — elle n'existe pas
# aujourd'hui.
#
# ## Usage
#   npm run typecheck:budget
#   scripts/typecheck-budget.sh [chemin-vers-fichier-de-seuil]
#
# Sortie :
#   - 0 si le compte mesuré == seuil déclaré (typecheck-budget.txt)
#   - 1 si le compte mesuré > seuil (régression — jamais toléré en silence)
#   - 1 si le compte mesuré < seuil (bonne nouvelle non enregistrée — le
#     seuil doit être abaissé dans le même commit, sinon il ne fait plus
#     office de garde-fou réel)

set -uo pipefail
# NB : pas de `set -e`. `npx tsc --noEmit` sort en code non-nul dès qu'il y
# a au moins une erreur — c'est le comportement NORMAL et ATTENDU de ce
# script (le compte peut légitimement être > 0). Un `set -e` ferait
# avorter le script sur cette sortie non-nulle avant même d'avoir pu
# compter les erreurs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUDGET_FILE="${1:-${REPO_ROOT}/typecheck-budget.txt}"

if [ ! -f "${BUDGET_FILE}" ]; then
  echo "Erreur : fichier de seuil introuvable : ${BUDGET_FILE}" >&2
  exit 1
fi

# Seuil déclaré : un entier seul sur la première ligne non vide.
THRESHOLD="$(grep -m1 -E '^[0-9]+$' "${BUDGET_FILE}" || true)"
if [ -z "${THRESHOLD}" ]; then
  echo "Erreur : ${BUDGET_FILE} ne contient pas d'entier valide sur sa première ligne." >&2
  exit 1
fi

echo "Garde-fou tsc --noEmit — seuil déclaré : ${THRESHOLD} (${BUDGET_FILE})"
echo "Exécution de : npx tsc --noEmit (peut prendre 1-2 minutes)"

cd "${REPO_ROOT}"
TSC_OUTPUT="$(npx tsc --noEmit 2>&1)"
# Code de sortie de tsc volontairement ignoré (voir commentaire au-dessus de
# `set -uo pipefail`) : c'est le COMPTE d'erreurs, pas le code de sortie, qui
# détermine le résultat de ce garde-fou.

ACTUAL_COUNT="$(printf '%s\n' "${TSC_OUTPUT}" | grep -c "error TS" || true)"

if ! [[ "${ACTUAL_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "Erreur interne : impossible d'extraire un compte numérique de la sortie de tsc." >&2
  echo "${TSC_OUTPUT}" >&2
  exit 1
fi

echo "Compte mesuré : ${ACTUAL_COUNT} erreur(s) TS"

if [ "${ACTUAL_COUNT}" -gt "${THRESHOLD}" ]; then
  DELTA=$((ACTUAL_COUNT - THRESHOLD))
  echo ""
  echo "❌ RÉGRESSION DE TYPAGE DÉTECTÉE"
  echo ""
  echo "   Seuil attendu  : ${THRESHOLD}"
  echo "   Compte mesuré  : ${ACTUAL_COUNT}"
  echo "   Delta          : +${DELTA} nouvelle(s) erreur(s) tsc introduite(s)"
  echo ""
  echo "   La dette de typage vient d'augmenter. C'est exactement ce que ce"
  echo "   garde-fou existe pour empêcher (voir ERR-186 dans"
  echo "   docs/knowledge/ERRORS-AND-FIXES.md : next build ne type-check pas"
  echo "   les fichiers __tests__, donc une régression de ce type reste"
  echo "   invisible sans lui)."
  echo ""
  echo "   Pour reproduire localement :"
  echo "     npx tsc --noEmit | grep \"error TS\""
  echo ""
  echo "   Pour corriger : résous la ou les nouvelles erreurs plutôt que"
  echo "   d'augmenter le seuil dans ${BUDGET_FILE} — augmenter le seuil"
  echo "   sans corriger revient à effacer la garantie que ce script existe"
  echo "   pour donner."
  echo ""
  exit 1
fi

if [ "${ACTUAL_COUNT}" -lt "${THRESHOLD}" ]; then
  DELTA=$((THRESHOLD - ACTUAL_COUNT))
  echo ""
  echo "✅ Bonne nouvelle : la dette de typage a baissé, mais elle n'est pas encore enregistrée."
  echo ""
  echo "   Seuil attendu  : ${THRESHOLD}"
  echo "   Compte mesuré  : ${ACTUAL_COUNT}"
  echo "   Delta          : -${DELTA} erreur(s) en moins qu'attendu"
  echo ""
  echo "   Le seuil ne doit jamais rester un plafond mou qui ne descend"
  echo "   jamais : abaisse-le dans le MÊME commit que la correction qui l'a"
  echo "   fait baisser."
  echo ""
  echo "   Pour corriger : remplace le contenu de ${BUDGET_FILE} par :"
  echo "     ${ACTUAL_COUNT}"
  echo ""
  exit 1
fi

echo ""
echo "✅ Compte mesuré (${ACTUAL_COUNT}) == seuil déclaré (${THRESHOLD}). Aucune action requise."
exit 0
