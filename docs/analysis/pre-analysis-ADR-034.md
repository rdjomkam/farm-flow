# Pré-analyse ADR-034 — Architecture du Filtrage des Relevés — 2026-04-06

## Statut : GO AVEC RÉSERVES

## Résumé

Le backend est quasi-complet (getReleves supporte déjà modifie, manque juste
l'exposition dans la route). Les composants UI nécessaires (Sheet, Select, Badge)
existent. Deux blockers techniques doivent être traités avant ou pendant
l'implémentation : le composant Switch est absent et l'API bacs ne supporte pas
le filtre ?vagueId=. La structure de routing nécessite aussi une clarification sur
la coexistence de src/app/releves/ et src/app/(farm)/releves/.

---

## Vérifications effectuées

### Composants UI requis : PARTIELLEMENT OK

- `src/components/ui/sheet.tsx` — PRESENT. Implémenté au-dessus de @radix-ui/react-dialog.
- `src/components/ui/select.tsx` — PRESENT.
- `src/components/ui/badge.tsx` — PRESENT.
- `src/components/ui/switch.tsx` — ABSENT. Aucun fichier switch.tsx dans src/components/ui/.
  Aucun paquet @radix-ui/react-switch dans package.json.
- `src/components/ui/checkbox.tsx` — ABSENT également (pas d'alternative prête).

### Référence de pattern : OK

- `src/components/analytics/feed-filters.tsx` — PRESENT et complet. Pattern exact
  documenté dans l'ADR (useRouter + useSearchParams + startTransition + état local
  synchronisé via useEffect + whitelist validation). Réutilisable tel quel.

### API /api/releves route : OK PARTIEL

- Fichier présent : `src/app/api/releves/route.ts`
- Paramètres actuellement parsés : vagueId, bacId, typeReleve, dateFrom, dateTo, nonLie.
- Paramètre `modifie` : NON exposé dans la route GET. La query function `getReleves()`
  le supporte déjà (ligne 41-43 de releves.ts). C'est le changement minimal décrit
  dans D6 — une ligne à ajouter.

### Query getReleves() : OK

- `src/lib/queries/releves.ts` — fonction exportée avec signature :
  `getReleves(siteId: string, filters: ReleveFilters, pagination?)`.
- Supporte tous les filtres : vagueId, bacId, typeReleve, dateFrom, dateTo, nonLie, modifie.
- R8 respectée : siteId en premier paramètre.

### Interface ReleveFilters : OK

- `src/types/api.ts` lignes 416-431 — interface complète avec vagueId, bacId,
  typeReleve, dateFrom, dateTo, nonLie, modifie. Exportée via src/types/index.ts.
- Les nouvelles interfaces ReleveSearchParams et ParsedReleveFilters décrites dans
  l'ADR n'existent pas encore (attendu — elles sont à créer).
- src/types/ui.ts n'existe pas encore (attendu — à créer ou à ajouter dans api.ts).

### Structure de routing : PROBLÈME

- `src/app/(farm)/releves/` — n'existe PAS. C'est la cible à créer.
- `src/app/releves/` — EXISTE avec deux fichiers : loading.tsx et nouveau/page.tsx.
- Le lien /releves dans la nav (farm-bottom-nav.tsx ligne 90, farm-sidebar.tsx
  ligne 84, ingenieur-sidebar.tsx ligne 87) est confirmé comme lien mort.
- L'ADR demande de déplacer src/app/releves/loading.tsx vers
  src/app/(farm)/releves/loading.tsx. Mais src/app/releves/nouveau/ contient la
  page de création de relevé. Si loading.tsx est déplacé hors de src/app/releves/,
  il ne s'appliquera plus à src/app/releves/nouveau/page.tsx.
  Risque : casser le loading state de la page nouveau si on déplace loading.tsx
  sans déplacer aussi nouveau/.

### API /api/bacs — filtre vagueId : ABSENT (BLOQUANT)

- `src/app/api/bacs/route.ts` — supporte uniquement ?libre=true. Aucun paramètre
  ?vagueId= n'est géré.
- `src/lib/queries/bacs.ts` — getBacs() filtre uniquement par siteId.
- L'ADR D5 requiert `GET /api/bacs?vagueId=...` pour le sélecteur de bac dynamique
  dans RelevesFilterSheet. Ce endpoint n'existe pas.
- Il faudra soit étendre getBacs() avec un filtre vagueId, soit écrire une nouvelle
  query getBacsParVague() et exposer le param dans la route.

### Navigation : CONFIRMÉ LIEN MORT

- farm-bottom-nav.tsx ligne 90 : href="/releves" sans page.tsx dans (farm)/releves/.
- farm-sidebar.tsx ligne 84 et ingenieur-sidebar.tsx ligne 87 : même constat.
- La correction (création de la page) est l'objectif même de l'ADR.

### i18n — Clés existantes : OK (base solide)

- fr/releves.json et en/releves.json existent et sont complets pour les types,
  les formulaires et les modifications.
- Les clés manquantes pour la nouvelle page (à créer dans les deux fichiers) :
  - releves.global.title ("Tous les relevés")
  - releves.global.filtres.bouton ("Filtres")
  - releves.global.filtres.titre ("Filtres")
  - releves.global.filtres.effacer ("Effacer tout")
  - releves.global.filtres.appliquer ("Appliquer ({count} actifs)")
  - releves.global.filtres.vague ("Vague")
  - releves.global.filtres.toutesVagues ("Toutes les vagues")
  - releves.global.filtres.bac ("Bac")
  - releves.global.filtres.tousBacs ("Tous les bacs")
  - releves.global.filtres.type ("Type de relevé")
  - releves.global.filtres.tousTyes ("Tous les types")
  - releves.global.filtres.du ("Du")
  - releves.global.filtres.au ("Au")
  - releves.global.filtres.modifie ("Relevés modifiés seulement")
  - releves.global.resultats ("{count} relevés trouvés")
  - releves.global.chargerPlus ("Charger {count} de plus")
  - releves.global.restants ("({count} restants)")
  - releves.global.filtresActifs.vague ("Vague : {code}")
  - releves.global.filtresActifs.bac ("Bac : {nom}")
  - releves.global.filtresActifs.periode.du ("Du {date}")
  - releves.global.filtresActifs.periode.au ("→ {date}")
  - releves.global.filtresActifs.modifie ("Modifiés seulement")

### ReleveDetails (extraction) : CONFIRMÉ NÉCESSAIRE

- src/components/vagues/releves-list.tsx ligne 41 : ReleveDetails est un memo
  local non exporté. L'extraction vers src/components/releves/releve-details.tsx
  est requise pour le partage avec RelevesGlobalList.

---

## Incohérences trouvées

### 1. Switch Radix absent — composant bloquant pour ModifieToggle

L'ADR (wireframe Sheet mobile) utilise un Radix Switch pour le toggle "Relevés
modifiés seulement". Ni src/components/ui/switch.tsx ni le paquet
@radix-ui/react-switch ne sont présents dans le projet.

Fichiers concernés : package.json, src/components/ui/
Suggestion : Installer @radix-ui/react-switch et créer switch.tsx, OU remplacer
le Switch par une Checkbox (pattern plus simple, cohérent avec le reste du projet).
La Checkbox n'existe pas non plus — une simple checkbox HTML native avec classe
Tailwind serait la solution la moins invasive.

### 2. API bacs ne supporte pas ?vagueId= — D5 non réalisable tel quel

L'ADR D5 requiert un appel `GET /api/bacs?vagueId=...` dans RelevesFilterSheet.
La route bacs actuelle ignore ce paramètre.

Fichiers concernés : src/app/api/bacs/route.ts, src/lib/queries/bacs.ts
Suggestion : Ajouter un paramètre optionnel vagueId dans la route GET bacs. Si
vagueId est fourni, retourner uniquement les bacs dont vagueId correspond. Query
simple : prisma.bac.findMany({ where: { siteId, vagueId } }).

### 3. Conflit de routing loading.tsx entre (farm)/releves/ et releves/nouveau/

src/app/releves/ contient actuellement loading.tsx (pour la route /releves) ET
nouveau/page.tsx (pour la route /releves/nouveau). Si loading.tsx est déplacé
dans (farm)/releves/, il cesse de s'appliquer à releves/nouveau/. Deux options :
a) déplacer tout src/app/releves/ vers src/app/(farm)/releves/ (recommandé),
b) dupliquer loading.tsx dans les deux emplacements.

Fichiers concernés :
- src/app/releves/loading.tsx
- src/app/releves/nouveau/page.tsx
- src/app/(farm)/releves/ (à créer)

### 4. Paramètre modifie absent de la route GET /api/releves

La query getReleves() supporte le filtre modifie (lignes 41-43 de releves.ts)
mais la route handler ne le lit pas depuis searchParams.

Fichier concerné : src/app/api/releves/route.ts
Fix : ajouter après `if (dateTo) filters.dateTo = dateTo;` :
  if (searchParams.get("modifie") === "true") filters.modifie = true;
Changement minimal, sans risque de régression.

---

## Risques identifiés

### 1. Déplacement de src/app/releves/ — risk de régression sur /releves/nouveau

Impact : Si loading.tsx est déplacé mais pas nouveau/page.tsx, la route
/releves/nouveau reste dans src/app/releves/nouveau/ et perd son loading state.
Mitigation : Déplacer l'intégralité de src/app/releves/ vers src/app/(farm)/releves/
en une seule opération. Vérifier que les liens FAB (fab-releve.tsx lignes 70 et 101
qui pointent vers /releves/nouveau) fonctionnent toujours après déplacement.

### 2. Switch vs Checkbox — choix d'implémentation à trancher avant le développement

Impact : Si le développeur installe @radix-ui/react-switch, c'est une nouvelle
dépendance. Si une checkbox native est utilisée à la place, l'ADR doit être amendé.
Mitigation : Décision à prendre maintenant. Recommandation : checkbox native
(input type="checkbox") stylée avec Tailwind — pas de dépendance supplémentaire,
cohérente avec le pattern des inputs natifs déjà utilisés pour les dates.

### 3. Architecture "Load More" avec URL params — accumulation non gérée

L'ADR décrit un Load More qui incrémente offset dans l'URL. Cela signifie que
charger plus remplace l'offset précédent — l'utilisateur perd les items déjà vus
et voit uniquement la nouvelle page (comportement pages, pas accumulation).
Si l'intention est d'accumuler, il faudra un Client Component avec state local
pour concaténer les résultats. L'ADR indique explicitement ce comportement mais
le développeur doit en être conscient.
Mitigation : Le comportement "page suivante remplace la précédente" est correct
selon l'ADR. Pas de modification requise, juste conscience du développeur.

---

## Prérequis manquants

1. Composant Switch ou décision d'alternative (Checkbox native) — requis avant
   l'implémentation de RelevesFilterSheet.

2. Support ?vagueId= dans GET /api/bacs — requis avant l'implémentation de
   RelevesFilterSheet (D5). Changement simple dans route.ts et queries/bacs.ts.

3. Décision sur la migration de src/app/releves/ — clarifier si tout le dossier
   est déplacé dans (farm)/releves/ ou uniquement loading.tsx. Recommandation :
   déplacer tout le dossier.

---

## Recommandation

GO — mais corriger les 3 points suivants en début d'implémentation (stories XS) :

a) Exposer modifie dans GET /api/releves (1 ligne — peut être fait en premier).
b) Ajouter ?vagueId= dans GET /api/bacs (route + query, ~10 lignes).
c) Décider Switch vs Checkbox native et créer le composant si nécessaire.
d) Déplacer src/app/releves/ complet vers src/app/(farm)/releves/ (déplacement de
   fichiers, pas de code à réécrire).

Les composants principaux (Sheet, Select, Badge, feed-filters pattern, ReleveFilters
interface, getReleves query) sont en place et stables. L'implémentation peut
démarrer dans l'ordre recommandé par l'ADR en traitant les 4 points ci-dessus
dans les premières stories.
