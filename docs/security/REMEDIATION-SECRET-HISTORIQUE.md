# Remédiation — secrets de production dans l'historique git

**Statut :** Note de remédiation, destinée à l'utilisateur/opérateur de production
**Date :** 2026-07-27 (mise à jour — suite critique CI.3/CI.4 : second identifiant identifié,
exposition plus ancienne que supposée initialement)
**Auteur :** @architect (documentation uniquement — aucune commande d'exécution, aucune valeur de
secret, aucune réécriture d'historique dans ce document ni dans ce sprint)
**Réfs :** ADR-052, R11 (`CLAUDE.md`), ADR-049 §Contexte, `docs/knowledge/ERRORS-AND-FIXES.md`

## Mise à jour — second identifiant exposé, périmètre de rotation élargi

Ce document couvrait initialement un seul incident (`scripts/data-fixes/gd3-apply.sh`, section 1
ci-dessous). Une seconde vérification, indépendante, a établi qu'un **second fichier** contenant
des identifiants de production est lui aussi tracké par git :

- **Fichier :** `.claude/settings.local.json`
- **Contenu concerné :** 3 occurrences d'URL avec identifiants, dont une URL de connexion vers
  l'hôte de production avec le compte `postgres` — jamais reproduite ni citée dans ce document,
  ni ailleurs dans le dépôt.
- **Étendue de l'exposition — plus longue que pour `gd3-apply.sh` :** ce fichier est tracké par git
  **depuis le commit initial du dépôt (`169c559`)**, et non depuis un commit intermédiaire comme
  `33ef046` pour l'autre incident. Concrètement, l'identifiant de production qu'il contient est
  **public depuis la création du dépôt** — toute la durée de vie du projet sur GitHub, pas
  seulement une fenêtre entre deux commits.
- **Action déjà effectuée dans ce sprint (CI.3/CI.4) :** le fichier a été retiré du suivi git
  (`git rm --cached .claude/settings.local.json`, opération d'index uniquement — le fichier reste
  présent et inchangé sur le disque local) et ajouté au `.gitignore`. Ce détrackage **empêche toute
  récidive à partir du prochain commit** : le fichier ne sera plus jamais recommis automatiquement.
  Il **n'efface rien** de l'historique déjà poussé sur GitHub — voir section 3 ci-dessous, qui
  s'applique identiquement à ce second incident : seule la rotation du secret le rend inoffensif.
- **Conséquence sur le périmètre de rotation :** la rotation à effectuer par l'utilisateur/opérateur
  (section 4 mise à jour ci-dessous) couvre désormais **les deux fichiers** : l'ancienne URL de
  `scripts/data-fixes/gd3-apply.sh` (section 1) **et** les identifiants de
  `.claude/settings.local.json`, en particulier le compte `postgres` de l'hôte de production.
  Ce sont potentiellement deux identifiants distincts (mots de passe/hôtes différents selon la
  configuration réelle, invérifiable depuis ce document par construction), donc potentiellement
  deux opérations de rotation distinctes côté production — à confirmer par l'opérateur ayant accès
  aux deux valeurs réelles.

---

## Ce que ce document fait — et ce qu'il ne fait pas

**Ce que ce sprint (CI) fait :** rendre la récidive impossible — un scanner de secrets (gitleaks)
tourne désormais en CI sur chaque `push`/`pull_request` et bloque le pipeline s'il détecte un motif
d'identifiant en dur, exactement le motif qui a permis à `gd3-apply.sh` de committer une URL de
connexion Postgres de production en clair (voir ADR-052 section 5.3, `CLAUDE.md` R11).

**Ce que ce sprint ne fait PAS :** gérer le secret déjà fuité. Ce document explique pourquoi cette
tâche — la rotation — n'appartient pas à un agent et ne peut pas être automatisée depuis ce dépôt :
elle touche l'infrastructure de production réelle, un environnement auquel aucun agent de ce projet
ne se connecte ni n'a de raison de se connecter. Ce document liste les emplacements à changer, dans
l'ordre, **sans jamais lire ni écrire aucune valeur** — c'est à l'utilisateur/opérateur d'exécuter
la rotation lui-même, avec ses propres accès.

---

## 1. Rappel factuel de l'incident (sans reproduire la valeur)

- Le script `scripts/data-fixes/gd3-apply.sh` a existé dans le dépôt entre le commit `33ef046`
  (introduction) et le commit `deee8b2` (suppression, sprint MG, application de R10 — voir
  ADR-049). Il contenait une URL de connexion Postgres de production avec mot de passe en clair.
- Le fichier **n'existe plus dans le working tree actuel** (`git ls-files` ne le liste pas), mais
  **le contenu du commit `33ef046` reste lisible dans l'historique git** — `git log`/`git show
  33ef046` retrouvent le fichier tel qu'il était, mot de passe inclus, pour quiconque a un accès en
  lecture au dépôt (clone local, fork GitHub, etc.).
- Le commit a été **poussé sur GitHub** avant sa suppression ultérieure par `deee8b2`.

## 2. Pourquoi la rotation est la seule remédiation qui compte

Un mot de passe qui a existé dans un commit poussé sur un dépôt distant doit être traité comme
**définitivement exposé**, indépendamment de ce qui arrive ensuite au dépôt :

- **Le commit a été poussé, donc potentiellement cloné.** Toute personne (ou processus automatisé —
  CI externe, outil de mirroring, bot d'indexation) ayant cloné le dépôt entre `33ef046` et
  `deee8b2` possède une copie locale complète de l'historique, y compris le secret, indépendamment
  de ce qui se passe ensuite sur GitHub.
- **Les forks GitHub conservent leur propre historique.** Si le dépôt a été forké pendant cette
  fenêtre, le fork garde le commit `33ef046` même après que le dépôt d'origine l'ait « supprimé » —
  GitHub ne propage pas une suppression d'historique vers les forks existants.
- **L'indexation externe est hors de contrôle.** Des services de scan de secrets tiers, des miroirs,
  ou de simples caches (CDN, proxies de clone) peuvent avoir capturé le contenu du commit pendant
  qu'il était public, sans laisser de trace consultable depuis ce dépôt.
- **Conséquence :** aucune opération sur *ce* dépôt ne peut faire disparaître une valeur qui a
  circulé publiquement. Seule la **rotation** du mot de passe côté serveur de production rend cette
  valeur exposée inoffensive — elle cesse simplement de correspondre à quoi que ce soit.

## 3. Pourquoi réécrire l'historique git n'est PAS un substitut à la rotation

Une réécriture d'historique (`git filter-branch`, `git filter-repo`, BFG Repo-Cleaner, ou un
nouveau dépôt recréé depuis un état propre) retire le commit litigieux de la copie du dépôt sur
laquelle l'opération est effectuée. **Ce sprint n'effectue aucune de ces opérations — elles ne sont
ni recommandées ni exécutées ici.** Raisons :

- Elle ne touche que **la copie sur laquelle elle est exécutée**. Elle ne peut pas atteindre les
  clones déjà existants ailleurs (postes de développeurs, forks, miroirs, caches) — ceux-ci
  conservent le commit d'origine avec le secret tant que leurs propriétaires ne la répliquent pas
  eux-mêmes (ce qui n'est ni garanti ni vérifiable depuis ce dépôt).
- Elle **casse tous les clones existants** : quiconque a cloné le dépôt avant la réécriture se
  retrouve avec un historique divergent de celui du serveur ; un `git pull` normal échoue, un
  `git push` ultérieur depuis un clone non resynchronisé peut réintroduire silencieusement l'ancien
  historique (donc le secret) sur le dépôt distant.
- Elle donne une **fausse impression de sécurité** : après une réécriture, le commit n'apparaît plus
  dans `git log` sur le dépôt réécrit, ce qui peut laisser croire que le problème est résolu — alors
  que la valeur elle-même, si elle a été vue par quiconque avant la réécriture, reste valide côté
  serveur de production jusqu'à ce qu'elle soit effectivement rotée.
- **Conclusion :** une réécriture d'historique est, au mieux, un nettoyage cosmétique **postérieur**
  à la rotation (pour ne plus exposer visuellement l'ancien commit à un nouveau clone), jamais un
  remplacement de la rotation elle-même. Si l'utilisateur souhaite malgré tout effectuer ce nettoyage
  cosmétique, cela reste une décision et une opération qui lui appartiennent entièrement — hors du
  périmètre de ce sprint et de tout agent de ce projet.

## 4. Emplacements à changer lors de la rotation, dans l'ordre — sans valeur

D'après l'inspection du dépôt (fichiers de configuration, jamais de connexion à un environnement
réel), voici où la valeur de `DATABASE_URL`/`POSTGRES_PASSWORD` de production est consommée, et
donc où une nouvelle valeur devra être renseignée après rotation. **Cette liste couvre maintenant
les deux incidents** (`gd3-apply.sh` section 1, et `.claude/settings.local.json` — voir la mise à
jour en tête de document) : si les identifiants qu'ils contiennent sont bien les mêmes, une seule
rotation suffit ; si ce sont deux comptes/mots de passe distincts, répéter la séquence pour chacun.

1. **Générer un nouveau mot de passe** côté moteur Postgres de production lui-même (commande
   d'administration Postgres, ex. `ALTER USER ... WITH PASSWORD ...`, exécutée par l'opérateur avec
   ses propres accès — hors du périmètre de ce document et de tout agent). À répéter pour le compte
   `postgres` si l'identifiant exposé dans `.claude/settings.local.json` s'avère être un compte
   distinct de celui utilisé par `gd3-apply.sh`.
2. **Le fichier `.env` du serveur de production** consommé par `docker-compose.prod.yml` via
   `env_file: - .env` pour le service `app` (variable `DATABASE_URL`) — ou l'équivalent « Environment
   Variables » du tableau de bord Coolify si c'est ce mécanisme qui gère réellement les variables
   plutôt qu'un fichier `.env` physique sur le serveur (indéterminable depuis le dépôt seul).
3. **La variable `POSTGRES_PASSWORD`** fournie au service `db` de `docker-compose.prod.yml` — même
   source que le point 2 (fichier `.env` du host ou dashboard Coolify) — si le mot de passe Postgres
   lui-même est roté (et pas seulement l'URL qui l'encode, si jamais ces deux éléments étaient gérés
   séparément).
4. **Redémarrer les conteneurs** `app`, `db`, et `cron` (`docker-compose.prod.yml`) après mise à
   jour des variables — `docker-entrypoint.sh` ne recharge pas dynamiquement une variable
   d'environnement modifiée à chaud ; aucun mécanisme de hot-reload n'a été observé dans le dépôt.
   Un redémarrage explicite est nécessaire pour que la nouvelle valeur soit effectivement utilisée.
5. **Vérifier qu'aucune autre occurrence en dur** de l'ancienne valeur ne subsiste ailleurs sur le
   serveur de production (scripts locaux au serveur, historique de shell si `gd3-apply.sh` a été
   copié/exécuté manuellement à un moment donné, tâches cron, secrets managers tiers) — ce point ne
   peut être vérifié que par l'opérateur ayant accès au serveur, pas depuis ce dépôt.
6. **Vérifier le poste local de développement** : `.claude/settings.local.json` reste présent (et
   fonctionnel, intentionnellement) sur le disque des postes de développement après le détrackage
   git — le détrackage retire uniquement le fichier du *suivi* git, pas du disque. Une fois la
   rotation effectuée côté production, mettre à jour la valeur dans ce fichier local pour refléter
   le nouvel identifiant, sur chaque poste où il existe.

Aucune autre occurrence de `DATABASE_URL` en dur n'a été trouvée dans le dépôt lui-même
(`Dockerfile`, `docker-compose*.yml`, `docker-entrypoint.sh`) — cohérent avec le fait que tout passe
déjà par l'environnement du conteneur, en dehors des deux incidents déjà identifiés
(`gd3-apply.sh`, traité par sa suppression au commit `deee8b2` ; `.claude/settings.local.json`,
traité par son détrackage dans ce sprint — voir mise à jour en tête de document). Dans les deux cas,
**le détrackage/la suppression du fichier n'efface rien de l'historique déjà poussé sur GitHub** :
seule la rotation invalide réellement le secret exposé.

## 5. Point de vérification recommandé à l'utilisateur — `.env.example` local

Indépendamment de l'incident `gd3-apply.sh` et sans lien de cause à effet avec lui : un fichier
`.env.example` existe localement sur le poste utilisé pour ce projet, mais **n'est pas tracké par
git** (absent de `git ls-files`, exclu par la règle `.env*` du `.gitignore`) — son contenu n'a donc
jamais fuité via git, ni dans le working tree commité, ni dans l'historique.

Cela dit, par précaution, il est recommandé à l'utilisateur de vérifier lui-même — sans qu'aucun
agent n'ait besoin de lire ou révéler la valeur — si les entrées `HETZNER_S3_ACCESS_KEY` et
`HETZNER_S3_SECRET_KEY` de ce fichier local ont la forme d'identifiants réels plutôt que de
placeholders (contrairement au reste du fichier, qui utilise systématiquement des préfixes explicites
du type `"your-..."` ou `"change-me-..."`). Si ces deux valeurs s'avèrent être de vrais identifiants
Hetzner plutôt que des exemples oubliés, il est recommandé de les retirer de ce fichier local et de
les roter côté Hetzner par précaution, même si le fichier n'a jamais été commité — un fichier
local peut être copié, synchronisé, ou inclus par erreur dans une sauvegarde de poste sans passer
par git.

Cette vérification est indépendante du reste de ce sprint et peut être effectuée à tout moment par
l'utilisateur, sans dépendre d'aucune autre étape de ce document.

## 6. Résumé actionnable

| Action | Qui | Statut vis-à-vis de ce sprint |
|---|---|---|
| Roter le(s) mot(s) de passe Postgres de production (identifiant de `gd3-apply.sh` **et** identifiant `postgres` de `.claude/settings.local.json`) | Utilisateur/opérateur, avec ses propres accès | **Non fait par ce sprint** — recommandé, hors périmètre agent |
| Mettre à jour `.env` prod / variables Coolify (`DATABASE_URL`, `POSTGRES_PASSWORD`) | Utilisateur/opérateur | **Non fait par ce sprint** |
| Redémarrer `app`/`db`/`cron` en prod | Utilisateur/opérateur | **Non fait par ce sprint** |
| Mettre à jour `.claude/settings.local.json` sur chaque poste de dev après rotation | Utilisateur, par poste | **Non fait par ce sprint** — le fichier reste intentionnellement présent et inchangé sur le disque |
| Vérifier absence de résidu de l'ancienne valeur ailleurs sur le serveur | Utilisateur/opérateur | **Non fait par ce sprint** — invérifiable depuis ce dépôt |
| Vérifier `HETZNER_S3_*` dans le `.env.example` local | Utilisateur | Recommandé par précaution, indépendant de l'incident |
| Détracker `.claude/settings.local.json` (`git rm --cached` + `.gitignore`) | Ce sprint (suite CI.3/CI.4) | **Fait par ce sprint** — index git seulement, fichier disque intact ; n'efface rien de l'historique déjà poussé |
| Empêcher la récidive sur les futurs commits (scanner de secrets en CI, règle R11, séparation scan diff bloquant / scan historique informatif) | Ce sprint (CI.2/CI.3/CI.4) | **Fait par ce sprint** — voir ADR-052, `CLAUDE.md` R11, `.github/workflows/ci.yml` (jobs `gitleaks-diff` et `gitleaks-history`) |
| Réécrire l'historique git pour retirer visuellement `33ef046` et/ou `169c559` | Décision de l'utilisateur, hors périmètre agent | **Non recommandé comme substitut à la rotation** — voir section 3 |
