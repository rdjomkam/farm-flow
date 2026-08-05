"use client";

/**
 * src/components/previsions/mapping-form-dialog.tsx
 *
 * Dialog de creation/edition d'une ligne de `MappingRapprochement` (Sprint
 * PR3-bis, stories PR3bis.4/PR3bis.5, ADR-053 section 3.9).
 *
 * PIEGE CENTRAL (pre-analyse section 1, "PIEGE CENTRAL") : `POST
 * /api/previsions/mapping-rapprochement` est un REMPLACEMENT EN BLOC — il
 * n'existe AUCUNE route d'ajout unitaire. `handleSubmit` relit donc TOUJOURS
 * le mapping actif COMPLET juste avant de soumettre (jamais une copie
 * potentiellement perimee recue en props), y fusionne la ligne courante
 * (ajout ou remplacement par cle `sourceType`+`sourceCle`), puis POSTe le
 * tableau entier. Un POST partiel desactiverait silencieusement toutes les
 * autres lignes actives du site (`creerVersionMapping`,
 * `previsions-rapprochement-mapping.ts:101-104`, `updateMany({actif:false})`
 * sur TOUT le site avant de creer la nouvelle version).
 *
 * RISQUE R1 (pre-analyse section 4), CORRIGE POUR POSTE_PREVISION (ADR-053
 * §16, story A.4) : `cibleId` d'un mapping SITE-scope referencait une entite
 * SCENARIO-scope (`PostePrevision`) — defaut ERR-179. Pour `POSTE_PREVISION`,
 * la liste de cibles est desormais SITE-scopee elle aussi (`GET
 * /api/previsions/postes-referentiel`, `PosteReferentielDTO`) : le meme
 * scope que `cibleId`, plus de desynchronisation possible par changement de
 * scenario. `ALIMENT_PREVISION` reste SCENARIO-scope (aucune entite
 * referentiel equivalente n'existe pour les aliments) — `scenarioWarning`
 * ne s'affiche donc plus que pour ce type, `siteScopedNote` le remplace pour
 * `POSTE_PREVISION`.
 *
 * CORRECTIF C1 (review + verification navigateur, sprint PR3-bis-bis),
 * TOUJOURS PERTINENT POUR ALIMENT_PREVISION, RECLASSE POUR POSTE_PREVISION
 * (story A.4) : en edition, si `existant.cibleId` n'appartient a AUCUNE des
 * cibles chargees, le `Select` Radix retombe sur son placeholder "Choisir…"
 * — l'administrateur croit alors qu'aucune cible n'est selectionnee, en
 * choisit une autre, et ECRASE SILENCIEUSEMENT la cible existante.
 * `cibleActuelleHorsScenario` detecte ce cas et rend la situation explicite
 * par un bandeau + une option de repli desactivee dans la liste — pour
 * ALIMENT_PREVISION cela signifie toujours "cible d'un autre scenario"
 * (`cibleHorsScenarioWarning`).
 *
 * PR2non.2 (resorption reserve R2, ERR-178 meme famille) : pour
 * POSTE_PREVISION, "introuvable" recouvrait en realite DEUX etats distincts
 * (absente du referentiel vs desactivee) confondus dans un seul message qui
 * s'avouait lui-meme flou ("elle a peut-etre ete desactivee"). Le fetch a
 * ete rebranche sur `GET /api/previsions/postes-referentiel/admin`
 * (`listerPostesReferentielAdmin`, TOUTES les entrees, actives ET
 * inactives, permission `PREVISIONS_PARAMETRER`) au lieu de `GET
 * /api/previsions/postes-referentiel` (`listerPostesReferentielActifs`, qui
 * ne renvoyait jamais l'info "desactive" au client). `postesActifs` (derive
 * localement) reste la SEULE source des `SelectItem` proposables comme
 * NOUVELLE cible (ADR-053 §16.12 Arbitrage 2 : la desactivation bloque tout
 * nouveau rattachement) ; `postes` (toutes entrees) sert uniquement a
 * determiner le statut de la cible EXISTANTE : absente (aucune entree,
 * quel que soit `actif`), desactivee (entree trouvee, `actif === false`,
 * libelle affiche pour un message actionnable), ou introuvable dans cette
 * branche (trouvee et active => hors bandeau). Ce dialog n'est rendu que
 * pour `peutParametrer` (`rapprochement-mapping-tab.tsx`), meme permission
 * que la nouvelle route — aucun utilisateur ne perd l'acces.
 *
 * Sprint PR3-ter, story A.2 : le `cibleId` d'un mapping `ALIMENT_PREVISION`
 * porte desormais le format compose `tailleGranule::alimentPrevisionId`
 * (story A.3, `src/lib/queries/previsions-rapprochement.ts`). Ce dialog
 * garde `cibleId` (etat React) comme la valeur BRUTE du `Select`
 * (l'`AlimentPrevision.id` du scenario COURANT, jamais compose) — la
 * composition n'intervient qu'AU SUBMIT (`composeCibleAlimentPrevisionClient`).
 * En edition, `existant.cibleId` (compose, potentiellement d'un AUTRE
 * scenario) est resolu DYNAMIQUEMENT vers l'`AlimentPrevision` du scenario
 * COURANT via sa `tailleGranule` (cle metier stable, jamais l'id fige) des
 * que les cibles sont chargees. Si aucune correspondance n'existe dans le
 * scenario courant (mapping ORPHELIN, story A.1), `cibleId` bascule sur le
 * sentinel `CIBLE_ALIMENT_ORPHELINE_SENTINEL` — jamais une chaine composee
 * brute passee tel quel a `<Select value=...>` (qui ne correspondrait a
 * aucune `SelectItem`, reproduisant ERR-177 pour un cas different).
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { CibleRapprochement, SourceRapprochement } from "@/types";
import type { MappingRapprochement } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import {
  libelleSourceCle,
  libelleSourceType,
  composeCibleAlimentPrevisionClient,
  extraireTailleGranuleDeCibleId,
} from "@/components/previsions/mapping-rapprochement-helpers";
import type { PosteReferentielDTO, AlimentPrevisionDTO } from "@/components/previsions/api-types";

interface MappingFormDialogProps {
  scenarioId: string;
  scenarioNom: string;
  source: { sourceType: SourceRapprochement; sourceCle: string };
  /** Ligne existante — presence => mode edition (source affichee mais non modifiable). `cibleId` deja au format compose pour ALIMENT_PREVISION (story A.3). */
  existant?: { cibleType: CibleRapprochement; cibleId: string | null };
  trigger: React.ReactNode;
  /** Le mapping actif COMPLET renvoye par le POST (nouvelle version) — le parent remplace son etat avec cette valeur, ne recalcule rien. */
  onSaved: (mappingActif: MappingRapprochement[]) => void;
}

const CIBLES_AVEC_ID = [CibleRapprochement.POSTE_PREVISION, CibleRapprochement.ALIMENT_PREVISION];

/**
 * Valeur de repli du `Select` (story A.2) quand la cible ORIGINALE d'un
 * mapping `ALIMENT_PREVISION` en edition ne correspond a AUCUN
 * `AlimentPrevision` du scenario COURANT (mapping ORPHELIN, story A.1) — sa
 * `tailleGranule` a disparu du scenario. Jamais l'`AlimentPrevision.id` brut
 * d'un autre scenario (ne correspondrait a aucune `SelectItem` reelle), et
 * jamais une chaine vide (retomberait sur le placeholder Radix, reproduisant
 * ERR-177). Valeur intentionnellement improbable pour ne jamais collisionner
 * avec un vrai `AlimentPrevision.id` (cuid).
 */
const CIBLE_ALIMENT_ORPHELINE_SENTINEL = "__cible_aliment_orpheline__";

export function MappingFormDialog({
  scenarioId,
  scenarioNom,
  source,
  existant,
  trigger,
  onSaved,
}: MappingFormDialogProps) {
  const t = useTranslations("previsions");
  const tStock = useTranslations("stock");
  const tDepenses = useTranslations("depenses");
  const tCommon = useTranslations("common");
  const { get, post } = usePrevisionsApi();

  // Story A.2 : pour ALIMENT_PREVISION, `existant.cibleId` est un format
  // COMPOSE (story A.3) — jamais utilisable directement comme valeur brute du
  // `Select` (ne correspondrait a aucune `SelectItem`). L'etat initial part
  // volontairement vide ; l'effet de resolution ci-dessous le peuple des que
  // les cibles du scenario courant sont chargees.
  function cibleIdInitiale(): string {
    if (existant?.cibleType === CibleRapprochement.ALIMENT_PREVISION) return "";
    return existant?.cibleId ?? "";
  }

  const [open, setOpen] = useState(false);
  const [cibleType, setCibleType] = useState<CibleRapprochement>(existant?.cibleType ?? CibleRapprochement.NON_RAPPROCHE);
  const [cibleId, setCibleId] = useState<string>(cibleIdInitiale);
  // Story A.2 : garde d'execution unique de la resolution ALIMENT_PREVISION
  // ci-dessous — evite de reecraser un choix utilisateur deja fait si l'effet
  // se redeclenche (ex. `aliments` change de reference sans changer de valeur).
  const [alimentInitialResolu, setAlimentInitialResolu] = useState(false);
  // PR2non.2 : TOUTES les entrees du referentiel (actives ET inactives) —
  // `GET .../admin`, jamais `GET /api/previsions/postes-referentiel` (actifs
  // seuls, qui masquerait la distinction absente/desactivee au client). Voir
  // `postesActifs` ci-dessous pour la liste effectivement selectionnable.
  const [postes, setPostes] = useState<PosteReferentielDTO[]>([]);
  const [aliments, setAliments] = useState<AlimentPrevisionDTO[]>([]);
  // CORRECTIF D1 (contre-review PR3-bis) : `chargementCibles` n'est plus un
  // booleen pilote par setState (qui laissait une fenetre de rendu, au tout
  // premier montage, ou `open === true` mais l'effet ci-dessous n'avait pas
  // encore commite `true` — pendant cette fenetre, `postes`/`aliments`
  // etaient vides et `cibleActuelleHorsScenario`/`cibleListeVide` pouvaient
  // a tort s'evaluer a `true`). Il est desormais DERIVE : on retient
  // uniquement le `scenarioId` pour lequel `postes`/`aliments` ont ete
  // charges avec succes ; le chargement est en cours si et seulement si le
  // dialog est ouvert et que cette valeur ne correspond pas (encore) au
  // `scenarioId` courant — vrai synchronement des le premier rendu ou`open`
  // devient `true`, sans aucune fenetre intermediaire. A dialog ferme (ou
  // jamais ouvert), `open` est `false` => `chargementCibles` est toujours
  // `false` (pas d'etat bloque a `true`, pas de spinner fantome).
  const [cibleDataScenarioId, setCibleDataScenarioId] = useState<string | null>(null);
  const chargementCibles = open && cibleDataScenarioId !== scenarioId;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  const exigeCibleId = CIBLES_AVEC_ID.includes(cibleType);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [postesResult, alimentsResult] = await Promise.all([
        // PR2non.2 : route admin (TOUTES les entrees) — voir en-tete de
        // fichier. Permission `PREVISIONS_PARAMETRER`, identique a la
        // condition de rendu de ce dialog (`peutParametrer`).
        get<{ data: PosteReferentielDTO[] }>(`/api/previsions/postes-referentiel/admin`, {
          silentError: true,
          silentLoading: true,
        }),
        get<{ data: AlimentPrevisionDTO[] }>(`/api/previsions/scenarios/${scenarioId}/aliments`, {
          silentError: true,
          silentLoading: true,
        }),
      ]);
      if (cancelled) return;
      if (postesResult?.ok && postesResult.data) setPostes(postesResult.data.data ?? []);
      if (alimentsResult?.ok && alimentsResult.data) setAliments(alimentsResult.data.data ?? []);
      // Marque ce `scenarioId` comme charge (que les deux appels aient
      // reussi ou non) : voir D2 ci-dessous — `chargementCibles` ne doit
      // pas rester bloque a `true` indefiniment en cas d'echec reseau isole.
      setCibleDataScenarioId(scenarioId);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scenarioId]);

  // Story A.2 : resolution DYNAMIQUE de la selection initiale ALIMENT_PREVISION
  // par tailleGranule (jamais par l'id fige porte par le format compose,
  // ADR-053 §3.9 amendement A.3) — miroir cote formulaire de
  // `resoudreCibleCleDuScenarioCourant` (`previsions-mapping-orphelins.ts`).
  // Ne s'execute qu'une fois par ouverture (garde `alimentInitialResolu`), et
  // seulement si l'utilisateur n'a pas deja touche le formulaire.
  useEffect(() => {
    // `chargementCibles` vaut FAUX aussi bien quand le dialog est FERME
    // (`open === false`, aucun chargement en cours par definition) que
    // quand il est OUVERT et les cibles sont chargees — sans le garde
    // explicite `!open` ci-dessous, cet effet resolvait au tout premier
    // montage (avant meme la premiere ouverture), avec `aliments` encore a
    // `[]`, posant a tort le sentinel orphelin et ne se redeclenchant plus
    // jamais ensuite (garde `alimentInitialResolu` deja consommee).
    if (!open || chargementCibles) return;
    if (alimentInitialResolu) return;
    if (touched) {
      setAlimentInitialResolu(true);
      return;
    }
    if (existant?.cibleType !== CibleRapprochement.ALIMENT_PREVISION || !existant?.cibleId) {
      setAlimentInitialResolu(true);
      return;
    }
    const tailleGranule = extraireTailleGranuleDeCibleId(existant.cibleId);
    const trouve = tailleGranule ? aliments.find((a) => a.tailleGranule === tailleGranule) : undefined;
    setCibleId(trouve ? trouve.id : CIBLE_ALIMENT_ORPHELINE_SENTINEL);
    setAlimentInitialResolu(true);
  }, [open, chargementCibles, aliments, existant, alimentInitialResolu, touched]);

  // CORRECTIF C1 : la cible ACTUELLE du formulaire (pas encore modifiee par
  // l'utilisateur) n'appartient a aucune des cibles chargees pour ce
  // scenario => elle appartient a un AUTRE scenario. Ne se declenche que
  // pour la valeur d'origine (`existant.cibleId`), jamais apres un choix
  // volontaire de l'utilisateur (une cible fraichement choisie est toujours
  // dans la liste puisqu'elle en est issue).
  //
  // Story A.2 : pour ALIMENT_PREVISION, `cibleId === existant.cibleId` ne
  // marche plus (format compose vs id brut resolu, voir plus haut) — le
  // sentinel `CIBLE_ALIMENT_ORPHELINE_SENTINEL` remplace cette comparaison :
  // il n'est POSE par l'effet de resolution ci-dessus QUE si la resolution a
  // echoue, jamais apres un choix utilisateur (`touched` interrompt l'effet
  // avant qu'il ne pose le sentinel).
  // PR2non.2 : `postes` porte desormais TOUTES les entrees (actives ET
  // inactives, route admin). `postesActifs` est la SEULE liste proposable
  // pour un NOUVEAU rattachement (`SelectItem`, ADR-053 §16.12 Arbitrage 2)
  // — une entree desactivee n'y figure jamais.
  const postesActifs = postes.filter((p) => p.actif);
  const listePertinente =
    cibleType === CibleRapprochement.POSTE_PREVISION
      ? postesActifs
      : cibleType === CibleRapprochement.ALIMENT_PREVISION
        ? aliments
        : [];
  // PR2non.2 : statut de la cible EXISTANTE (POSTE_PREVISION uniquement),
  // recherche dans `postes` (TOUTES les entrees, pas `postesActifs`) pour
  // distinguer "absente" (aucune entree, quel que soit `actif`) de
  // "desactivee" (entree trouvee, `actif === false`) — la meme distinction
  // qu'ERR-178 (« n'existe pas » vs « n'a pas pu etre charge »), ici pour un
  // troisieme etat de la meme famille (« existe mais desactivee »). `null`
  // si la cible n'a pas change depuis `existant` (garde `!touched`, comme
  // CORRECTIF C1) ou si elle est trouvee ET active (cas nominal, hors
  // bandeau).
  const cibleReferentielPertinente =
    exigeCibleId &&
    !chargementCibles &&
    !touched &&
    cibleType === CibleRapprochement.POSTE_PREVISION &&
    cibleType === existant?.cibleType &&
    !!existant?.cibleId &&
    cibleId === existant.cibleId;
  const cibleReferentielExistante = cibleReferentielPertinente
    ? postes.find((p) => p.id === existant!.cibleId)
    : undefined;
  const cibleReferentielStatut: "absente" | "desactivee" | null = !cibleReferentielPertinente
    ? null
    : cibleReferentielExistante === undefined
      ? "absente"
      : cibleReferentielExistante.actif
        ? null
        : "desactivee";
  // CORRECTIF C1 : la cible ACTUELLE du formulaire (pas encore modifiee par
  // l'utilisateur) n'appartient a aucune des cibles chargees pour ce
  // scenario => elle appartient a un AUTRE scenario. Ne se declenche que
  // pour la valeur d'origine (`existant.cibleId`), jamais apres un choix
  // volontaire de l'utilisateur (une cible fraichement choisie est toujours
  // dans la liste puisqu'elle en est issue).
  //
  // Story A.2 : pour ALIMENT_PREVISION, `cibleId === existant.cibleId` ne
  // marche plus (format compose vs id brut resolu, voir plus haut) — le
  // sentinel `CIBLE_ALIMENT_ORPHELINE_SENTINEL` remplace cette comparaison :
  // il n'est POSE par l'effet de resolution ci-dessus QUE si la resolution a
  // echoue, jamais apres un choix utilisateur (`touched` interrompt l'effet
  // avant qu'il ne pose le sentinel).
  //
  // PR2non.2 : pour POSTE_PREVISION, ce bandeau couvre desormais DEUX
  // sous-etats distincts (`cibleReferentielStatut`, absente/desactivee) —
  // voir le rendu ci-dessous pour le choix du message.
  const cibleActuelleHorsScenario =
    exigeCibleId &&
    !chargementCibles &&
    !touched &&
    !!existant?.cibleId &&
    cibleType === existant.cibleType &&
    (cibleType === CibleRapprochement.ALIMENT_PREVISION
      ? cibleId === CIBLE_ALIMENT_ORPHELINE_SENTINEL
      : cibleReferentielStatut !== null);
  // CORRECTIF C2 : cable la cle i18n `fields.cibleId.empty` (auparavant
  // morte) — distincte du cas ci-dessus, elle couvre l'absence totale
  // d'options pour ce `cibleType` dans ce scenario.
  const cibleListeVide = exigeCibleId && !chargementCibles && !cibleActuelleHorsScenario && listePertinente.length === 0;

  function resetForm() {
    setCibleType(existant?.cibleType ?? CibleRapprochement.NON_RAPPROCHE);
    setCibleId(cibleIdInitiale());
    setAlimentInitialResolu(false);
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit() {
    // Story A.2 : le sentinel orphelin n'est jamais une selection valide —
    // l'utilisateur DOIT choisir une cible reelle du scenario courant pour
    // remplacer une cible orpheline, jamais la resoumettre telle quelle.
    if (exigeCibleId && (!cibleId || cibleId === CIBLE_ALIMENT_ORPHELINE_SENTINEL)) {
      setError(t("rapprochementTab.mapping.form.errors.cibleIdRequired"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Relecture FRAICHE du mapping actif complet — jamais une copie
      // potentiellement perimee (voir en-tete de fichier, "PIEGE CENTRAL").
      const mappingActuel = await get<{ data: MappingRapprochement[] }>(
        "/api/previsions/mapping-rapprochement"
      );
      if (!mappingActuel.ok || !mappingActuel.data) {
        setError(t("rapprochementTab.mapping.loadError"));
        return;
      }

      // Story A.2/A.3 : ALIMENT_PREVISION compose desormais `tailleGranule::id`
      // — jamais l'id brut du `Select`. `cibleId` (etat) reste TOUJOURS
      // l'`AlimentPrevision.id` du scenario COURANT (jamais compose), la
      // composition n'intervient qu'ici, au moment d'envoyer le payload.
      let cibleIdAEnvoyer: string | null = null;
      if (exigeCibleId) {
        if (cibleType === CibleRapprochement.ALIMENT_PREVISION) {
          const alimentSelectionne = aliments.find((a) => a.id === cibleId);
          if (!alimentSelectionne) {
            // Ne devrait jamais se produire (le Select ne propose que des
            // options issues de `aliments`, et le sentinel est deja intercepte
            // ci-dessus) — filet de securite explicite plutot qu'une exception
            // non geree ou une composition avec une tailleGranule absente.
            setError(t("rapprochementTab.mapping.form.errors.cibleIdRequired"));
            return;
          }
          cibleIdAEnvoyer = composeCibleAlimentPrevisionClient(alimentSelectionne.tailleGranule, alimentSelectionne.id);
        } else {
          cibleIdAEnvoyer = cibleId;
        }
      }

      const nouvelleLigne = {
        sourceType: source.sourceType,
        sourceCle: source.sourceCle,
        cibleType,
        cibleId: cibleIdAEnvoyer,
      };

      const lignes = mappingActuel.data.data
        .filter((l) => !(l.sourceType === source.sourceType && l.sourceCle === source.sourceCle))
        .map((l) => ({
          sourceType: l.sourceType,
          sourceCle: l.sourceCle,
          cibleType: l.cibleType,
          cibleId: l.cibleId,
        }));
      lignes.push(nouvelleLigne);

      const result = await post<{ data: MappingRapprochement[] }>(
        "/api/previsions/mapping-rapprochement",
        { lignes }
      );
      if (result.ok && result.data) {
        onSaved(result.data.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>
            {existant ? t("rapprochementTab.mapping.form.dialogTitleEdit") : t("rapprochementTab.mapping.form.dialogTitleCreate")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("rapprochementTab.mapping.form.sourceLabel")}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {libelleSourceType(source.sourceType, t)} — {libelleSourceCle(source.sourceType, source.sourceCle, { tDepenses, tStock, tPrevisions: t })}
              </p>
            </div>

            <Select
              value={cibleType}
              onValueChange={(v) => {
                setCibleType(v as CibleRapprochement);
                setCibleId("");
                setTouched(true);
              }}
            >
              <SelectTrigger label={t("rapprochementTab.mapping.form.fields.cibleType.label")} required>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CibleRapprochement).map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`rapprochementTab.mapping.cibleTypes.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {exigeCibleId && (
              <>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {cibleType === CibleRapprochement.POSTE_PREVISION
                    ? t("rapprochementTab.mapping.form.siteScopedNote", { scenario: scenarioNom })
                    : t("rapprochementTab.mapping.form.scenarioWarning", { scenario: scenarioNom })}
                </div>
                {cibleActuelleHorsScenario && (
                  <div role="alert" className="rounded-lg border border-warning/40 bg-accent-amber-muted p-3 text-xs text-warning">
                    {cibleType === CibleRapprochement.POSTE_PREVISION
                      ? cibleReferentielStatut === "desactivee"
                        ? t("rapprochementTab.mapping.form.cibleReferentielDesactiveeWarning", {
                            libelle: cibleReferentielExistante?.libelle ?? "",
                          })
                        : t("rapprochementTab.mapping.form.cibleReferentielAbsenteWarning")
                      : t("rapprochementTab.mapping.form.cibleHorsScenarioWarning", { scenario: scenarioNom })}
                  </div>
                )}
                <Select
                  value={cibleId}
                  onValueChange={(v) => {
                    setCibleId(v);
                    setTouched(true);
                  }}
                >
                  <SelectTrigger
                    label={t("rapprochementTab.mapping.form.fields.cibleId.label")}
                    required
                    error={error ?? undefined}
                  >
                    <SelectValue placeholder={t("rapprochementTab.mapping.form.fields.cibleId.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {cibleActuelleHorsScenario && (
                      <SelectItem value={cibleId} disabled>
                        {t("rapprochementTab.mapping.form.fields.cibleId.horsScenario")}
                      </SelectItem>
                    )}
                    {cibleType === CibleRapprochement.POSTE_PREVISION &&
                      // PR2non.2 : `postesActifs` (jamais `postes`, qui
                      // porte aussi les entrees desactivees) — une entree
                      // desactivee n'est JAMAIS proposable comme NOUVELLE
                      // cible (ADR-053 §16.12 Arbitrage 2).
                      postesActifs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.libelle}
                        </SelectItem>
                      ))}
                    {cibleType === CibleRapprochement.ALIMENT_PREVISION &&
                      aliments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {tStock(`produits.taillesGranule.${a.tailleGranule}`)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {cibleListeVide && (
                  <p className="text-xs text-muted-foreground">{t("rapprochementTab.mapping.form.fields.cibleId.empty")}</p>
                )}
              </>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {t("rapprochementTab.mapping.form.versioningNote")}
            </div>

            {error && !exigeCibleId && <p className="text-sm text-danger">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t("rapprochementTab.mapping.form.submitting")
              : existant
                ? t("rapprochementTab.mapping.form.submitEdit")
                : t("rapprochementTab.mapping.form.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
