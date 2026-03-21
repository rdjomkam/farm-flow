# Pré-analyse Sprint 37.2 — 2026-03-21

## Statut : GO AVEC RÉSERVES

## Résumé
La Story 37.2 (Polish UX abonnements) est techniquement faisable sans prérequis bloquants.
Les travaux à réaliser sont majoritairement additifs (nouveaux fichiers loading.tsx, ajout d'attributs,
ajout d'états squelette). Cinq incohérences de qualité identifiées, aucune ne bloque le démarrage.

---

## Vérifications effectuées

### 1. Formulaire checkout (src/components/abonnements/checkout-form.tsx)

**Champ téléphone :** OK partiellement.
- `type="tel"` est présent (ligne 480).
- `autoComplete="tel"` est présent (ligne 488).
- `inputmode="numeric"` est ABSENT. Ce point est explicitement demandé par la story.

**Boutons "étape suivante" :**
- Étape 1 : Bouton "Continuer" avec `w-full min-h-[44px]` — OK, taille conforme mobile.
- Étape 2 : Boutons "Retour" et "Payer maintenant" dans `flex gap-3` avec `flex-1 min-h-[44px]` — OK sur 360px.
- Pas de risque de coupure identifié.

**Barre de progression à 360px — PROBLÈME IDENTIFIÉ.**
- Les labels texte des étapes ("Plan & Période", "Paiement", "Confirmation") ont la classe `hidden sm:block`.
  Ils sont donc masqués à 360px, ce qui est correct pour éviter le débordement.
- Cependant, les cercles de progression (w-8 h-8) + les séparateurs (h-0.5) sont dans un `flex items-center gap-2`.
  La structure utilise `flex-1` sur chaque groupe et `flex-1 mx-1` sur les séparateurs.
  Sur 360px avec `max-w-lg mx-auto px-4`, la largeur utile est 360 - 32 = 328px.
  3 cercles de 32px + 2 séparateurs flex-1 + gap-2 (8px × 2) = 96 + 16 + espaces flex = correct.
  Pas de débordement structurel identifiable par analyse statique.
- Le `role="progressbar"` sur le container `div` avec `aria-valuenow/min/max` est sémantiquement
  incorrect : `progressbar` s'applique à un élément avec progression linéaire (0-100%), pas à un
  stepper d'étapes numérotées. Le rôle correct serait une liste (`ol/li`) ou l'absence de rôle ARIA,
  avec un `aria-current="step"` sur l'étape active.

### 2. Page mon-abonnement (src/app/mon-abonnement/page.tsx)

**États de chargement :** Aucun `loading.tsx` dans ce répertoire. La page utilise `force-dynamic`
ce qui désactive le cache mais ne fournit pas d'UI de chargement streaming Next.js.

**État vide (pas d'abonnement) :** Présent (lignes 81-93) — message + lien "Voir les plans". OK.

**État vide (pas de paiements) :** La section historique est conditionnée par `paiements.length > 0`
(ligne 73). Si paiements est vide, la section disparaît silencieusement sans message explicatif.
Le composant `PaiementsHistoryList` gère lui-même l'état vide, mais il n'est jamais rendu dans
ce cas. Comportement acceptable mais non cohérent avec la story qui demande des messages d'état vides.

**Skeleton :** Aucun skeleton sur `AbonnementActuelCard` ni `PaiementsHistoryList`.

### 3. Page mon-portefeuille (src/app/mon-portefeuille/page.tsx)

**États de chargement :** Aucun `loading.tsx` dans ce répertoire. Même situation que mon-abonnement.

**État vide (commissions) :** `CommissionsList` gère l'état vide en interne (ligne 110-113 :
"Aucune commission dans cette catégorie.") — OK pour la liste filtrée.
Mais si `commissions` est un tableau vide, la section entière s'affiche quand même avec l'en-tête
"Mes commissions" et les tabs (même s'ils montrent tous 0). Pas de message de type "Vous n'avez
pas encore de commissions" au niveau de la page.

**État vide (retraits) :** La section retraits est conditionnée par `retraitsFormatted.length > 0` — OK.

**Portefeuille null :** Si `getPortefeuille()` retourne `{ portefeuille: null, commissionsRecentes: [] }`,
le code utilise des valeurs par défaut (solde = 0, etc.). `PortefeuilleSummary` s'affiche avec des
zéros — comportement acceptable mais sans message de type "Votre portefeuille n'est pas encore créé".

**Skeleton :** Aucun skeleton sur `PortefeuilleSummary` ni `CommissionsList`.

### 4. Fichiers loading.tsx existants

Les fichiers suivants existent déjà :
- `src/app/loading.tsx` (dashboard racine)
- `src/app/bacs/loading.tsx`
- `src/app/stock/loading.tsx`
- `src/app/finances/loading.tsx`
- `src/app/vagues/loading.tsx`
- `src/app/vagues/[id]/loading.tsx`

Manquants pour la story 37.2 :
- `src/app/checkout/loading.tsx` — ABSENT
- `src/app/mon-abonnement/loading.tsx` — ABSENT
- `src/app/mon-portefeuille/loading.tsx` — ABSENT

### 5. Formatage des prix

**Composants commissions :** Tous utilisent `Intl.NumberFormat("fr-CM", { currency: "XAF" })` — CORRECT.
Aucune devise €, $, USD, EUR détectée.

**Composants abonnements — INCOHÉRENCE IDENTIFIÉE :**
- `checkout-form.tsx` : `formatPrix` utilise `toLocaleString("fr-FR") + " FCFA"` — FCFA suffix manuel.
- `plans-grid.tsx` : `formatPrix` utilise `toLocaleString("fr-FR") + " FCFA"` — même pattern.
- `paiements-history-list.tsx` : `paiement.montant.toLocaleString("fr-FR") + " FCFA"` inline — même.
- `abonnements-admin-list.tsx` : même pattern FCFA manuel.

Aucun € ou $ détecté. Cependant, le pattern `toLocaleString("fr-FR") + " FCFA"` est différent du
pattern `Intl.NumberFormat("fr-CM", { currency: "XAF" })` utilisé dans les composants commissions.
La story demande d'utiliser `Intl.NumberFormat` avec XAF de façon cohérente. La valeur affichée
n'est pas incorrecte (FCFA = XAF), mais le format n'est pas uniforme entre les deux sections.

Note : `Intl.NumberFormat("fr-CM", { currency: "XAF" })` affiche "FCFA" via le symbole currency de la
locale fr-CM. Le rendu est identique, mais le code n'est pas uniforme. La story demande explicitement
de vérifier et corriger ce point.

### 6. Accessibilité des badges de statut

**Badges StatutAbonnement (`abonnement-actuel-card.tsx`) :** Le composant `Badge` affiche le label
textuel (ex: "Actif", "En grâce") mais n'a pas d'`aria-label` explicite. Le texte est visible donc
lisible par les lecteurs d'écran. Acceptable mais peut être amélioré.

**Badges StatutPaiementAbo (`paiements-history-list.tsx`) :** Même situation — texte visible, pas d'aria-label.

**Badges `plans-grid.tsx` :** Cartes de plan sans `role="article"` ou `aria-label` explicite sur le
contexte de la carte. Les cartes sont des `div` sans rôle sémantique.

**Badges statut commissions (`commissions-list.tsx`) :** Spans inline sans aria-label. Texte visible OK.

### 7. Vérification des erreurs connues (ERRORS-AND-FIXES.md)

- ERR-008 (conflit enum Prisma vs @/types) : Non applicable ici, la story est UI/UX uniquement.
- ERR-012 (cast enums Server Components) : Déjà appliqué dans `mon-abonnement/page.tsx` (lignes 61-65). OK.
- Aucune autre erreur connue ne s'applique directement à cette story.

---

## Incohérences trouvées

1. **`inputmode="numeric"` absent sur le champ téléphone**
   - Fichier : `src/components/abonnements/checkout-form.tsx` ligne 479-489
   - Impact : Sur mobile, le clavier affiché est alphanumérique au lieu du clavier numérique.
   - Fix : Ajouter `inputMode="numeric"` à l'`Input` du champ téléphone.

2. **Formatage des prix incohérent entre abonnements et commissions**
   - Fichiers : `src/components/abonnements/checkout-form.tsx`, `plans-grid.tsx`, `paiements-history-list.tsx`, `abonnements-admin-list.tsx`
   - Impact : La section abonnements utilise `toLocaleString + " FCFA"` tandis que la section commissions utilise `Intl.NumberFormat("fr-CM", { currency: "XAF" })`.
   - Fix : Centraliser dans une fonction `formatXAF` utilisant `Intl.NumberFormat` et l'appliquer dans les composants abonnements.

3. **`role="progressbar"` incorrect sur le stepper d'étapes**
   - Fichier : `src/components/abonnements/checkout-form.tsx` ligne 84
   - Impact : Sémantique ARIA incorrecte pour les lecteurs d'écran — un `progressbar` représente une progression linéaire, pas un stepper multi-étapes.
   - Fix : Remplacer par `role="list"` avec `role="listitem"` sur chaque étape, et `aria-current="step"` sur l'étape active.

4. **Pas de `loading.tsx` pour checkout, mon-abonnement, mon-portefeuille**
   - Fichiers manquants : `src/app/checkout/loading.tsx`, `src/app/mon-abonnement/loading.tsx`, `src/app/mon-portefeuille/loading.tsx`
   - Impact : Pas d'UI de chargement streaming — la page est blanche pendant le fetch serveur.
   - Fix : Créer les 3 fichiers avec des skeletons adaptés au contenu de chaque page.

5. **Pas de skeleton dans AbonnementActuelCard, PortefeuilleSummary, CommissionsList**
   - Fichiers : `src/components/abonnements/abonnement-actuel-card.tsx`, `src/components/commissions/portefeuille-summary.tsx`, `src/components/commissions/commissions-list.tsx`
   - Impact : Les loading.tsx devront utiliser des skeletons ad-hoc définis inline, ou des nouveaux patterns dans `skeleton-patterns.tsx`.
   - Note : Les patterns de skeleton existants (`KPICardSkeleton`, `ListItemSkeleton`) sont réutilisables. Pas besoin de nouveaux composants complexes.

6. **État vide "pas de commissions" absent au niveau de la page mon-portefeuille**
   - Fichier : `src/app/mon-portefeuille/page.tsx` lignes 81-86
   - Impact : Un ingénieur sans commissions voit les tabs "En attente (0)", "Disponibles (0)", etc. sans message d'invitation.
   - Fix : Ajouter un message conditionnel avant `CommissionsList` si `commissions.length === 0`.

---

## Risques identifiés

1. **Régression sur le formatage des prix si la refactorisation `formatXAF` est incomplète**
   - Impact : Des prix non formatés ou avec symbole incorrect si le refactoring est partiel.
   - Mitigation : Créer une fonction utilitaire partagée dans `src/lib/abonnements-constants.ts` et l'importer dans tous les composants concernés en une seule fois.

2. **`Intl.NumberFormat("fr-CM", { currency: "XAF" })` peut retourner "XAF" au lieu de "FCFA" selon l'environnement Node.js**
   - Impact : En SSR Node.js sans les data ICU complètes, le symbole peut s'afficher "XAF" au lieu de "FCFA".
   - Mitigation : Tester le rendu SSR avant de migrer. Conserver le pattern `toLocaleString + " FCFA"` comme fallback si nécessaire.

---

## Prérequis manquants

Aucun prérequis bloquant. Story 37.1 est FAIT (confirmé dans le contexte). Les composants cibles
existent et sont accessibles.

---

## Fichiers à créer

| Fichier | Raison |
|---------|--------|
| `src/app/checkout/loading.tsx` | Loading skeleton page checkout |
| `src/app/mon-abonnement/loading.tsx` | Loading skeleton page abonnement |
| `src/app/mon-portefeuille/loading.tsx` | Loading skeleton page portefeuille |

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/components/abonnements/checkout-form.tsx` | Ajouter `inputMode="numeric"` sur Input téléphone ; corriger `role="progressbar"` en stepper ARIA ; harmoniser `formatPrix` vers `Intl.NumberFormat` |
| `src/components/abonnements/paiements-history-list.tsx` | Harmoniser formatage prix vers `Intl.NumberFormat` |
| `src/components/abonnements/plans-grid.tsx` | Harmoniser `formatPrix` vers `Intl.NumberFormat` |
| `src/app/mon-portefeuille/page.tsx` | Ajouter message état vide si `commissions.length === 0` |

## Fichiers optionnels (si skeleton centralisé)

| Fichier | Modification |
|---------|-------------|
| `src/components/ui/skeleton-patterns.tsx` | Ajouter `AbonnementCardSkeleton`, `PortefeuilleSkeleton`, `CommissionsListSkeleton` |

---

## Recommandation

GO. Commencer par les 3 `loading.tsx` (purement additifs, risque zéro), puis le `inputMode="numeric"`
(1 ligne), puis les états vides, puis le refactoring `formatXAF` (valider le rendu SSR avant de
généraliser). Corriger le `role="progressbar"` en dernière étape car cela touche la structure JSX
du stepper.
