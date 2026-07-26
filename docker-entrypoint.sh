#!/bin/sh
set -e

echo "Running Prisma migrations..."
# MG.7 — Un echec de migration DOIT bloquer le demarrage du conteneur.
#
# Pourquoi ce comportement (volontairement different de l'ancien
# `|| echo "WARNING ..."` qui avalait l'echec et laissait le serveur demarrer
# quand meme) :
#
#   Le sprint MG a introduit des garde-fous de migration (blocs
#   `DO $$ ... RAISE EXCEPTION ...`, cf. ADR-049 section 3.3.d) qui existent
#   uniquement pour empecher qu'une migration s'applique sur des donnees qui
#   ne satisfont pas leurs preconditions et corrompe la production. Un
#   garde-fou qui declenche une exception mais dont l'echec est avale par ce
#   script ne protege plus rien : le conteneur demarre quand meme, sur un
#   schema non migre / des donnees non corrigees, en silence. Un conteneur
#   qui refuse de demarrer est un incident visible (le monitoring/l'operateur
#   le voit immediatement) ; un conteneur qui demarre sur un schema
#   incoherent est un incident invisible et strictement pire, car il peut
#   corrompre des donnees ou servir des reponses fausses pendant longtemps
#   avant detection.
#
# NE PAS retablir `|| echo "WARNING ..."` ici : cela viderait de sa garantie
# l'ensemble des garde-fous de migration du sprint MG. Si `migrate deploy`
# echoue, la cause exacte est deja visible juste au-dessus dans les logs
# (sortie standard/erreur de la commande Prisma) — ce bloc ne fait que
# transformer cet echec en arret explicite du conteneur, avec un message qui
# renvoie a cette sortie plutot que de la dupliquer.
if ! npx prisma migrate deploy; then
  echo "=================================================================="
  echo "ERREUR FATALE : le deploiement des migrations Prisma a echoue."
  echo "Le demarrage du serveur est volontairement interrompu."
  echo ""
  echo "Ce n'est PAS un bug de ce script : c'est un choix delibere (voir"
  echo "commentaire ci-dessus dans docker-entrypoint.sh, story MG.7)."
  echo "Demarrer l'application malgre un echec de migration risquerait de"
  echo "faire tourner du code applicatif sur un schema ou des donnees"
  echo "incoherents (schema non migre, garde-fou de donnees declenche)."
  echo ""
  echo "Consultez la sortie de 'prisma migrate deploy' juste au-dessus pour"
  echo "identifier la migration en echec et sa cause exacte avant de"
  echo "relancer le deploiement."
  echo "=================================================================="
  exit 1
fi

echo "Starting Next.js server..."
exec node server.js
