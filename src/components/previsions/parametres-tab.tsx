"use client";

/**
 * src/components/previsions/parametres-tab.tsx
 *
 * Onglet Parametres — ParametresPrevision (edition PREVISIONS_PARAMETRER) et
 * PalierRemise (liste a somme non contrainte, mais seuils strictement
 * croissants — valide cote API, §8(b) ADR-053). Tous les champs ici sont de
 * la SAISIE (bordure standard `Input`), jamais des valeurs calculees.
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/ui/form-section";
import { Plus, Trash2, Link2 } from "lucide-react";
import { Permission } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import type { ScenarioPrevisionDetailDTO, ParametresPrevisionDTO, PalierRemiseDTO } from "@/components/previsions/api-types";

interface ParametresTabProps {
  scenario: ScenarioPrevisionDetailDTO;
  permissions: Permission[];
  /**
   * Appele apres toute mutation reussie (parametres ou paliers) — declenche
   * `router.refresh()` cote shell (`scenario-detail-client.tsx`) pour que le
   * Tableau de bord / la vue Previsions refletent le nouveau parametrage,
   * sans quoi la projection affichee resterait perimee jusqu'au rechargement
   * complet de la page (bugfix post-PR2ter). Optionnel pour ne pas casser
   * les rendus de test qui instancient ce composant isolement.
   */
  onDataChanged?: () => void;
}

const CHAMPS: (keyof ParametresPrevisionDTO)[] = [
  "effectifAlevinsParVague",
  "margeSecuriteAlevinsPct",
  "poidsMoyenInitialG",
  "poidsObjectifG",
  "prixAlevinUnitaireFCFA",
  "prixVenteKgFCFA",
  "nombreBacsSimultanesCible",
  "frequenceStockageMois",
  "tauxEpargnePct",
];

const CHAMPS_TRANSPORT: (keyof ParametresPrevisionDTO)[] = [
  "capaciteTransportAlimentsSacs",
  "coutTransportAlimentsFCFA",
  "capaciteTransportPoissonsKg",
  "coutTransportPoissonsFCFA",
  "capaciteTransportAlevinsNb",
  "coutTransportAlevinsFCFA",
];

/**
 * Bornes HTML alignees champ par champ sur les regles zod de
 * `src/lib/validation/previsions.schema.ts` (`parametresPrevisionCreateSchema`
 * / `updateParametresPrevisionSchema`) — jamais un `min="0"` par reflexe sur
 * tous les champs : chaque entree ci-dessous reflete la regle reelle.
 * `strictPositiveInt` -> min 1, step 1 ; entier non-negatif -> min 0, step 1 ;
 * `nonNegativeNumber` -> min 0 (decimal, pas de step contraint) ;
 * `frequenceStockageMois` (`.positive()`) -> min strictement positif ;
 * `tauxEpargnePct` (0..100) -> min 0, max 100.
 */
const CONTRAINTES: Partial<Record<keyof ParametresPrevisionDTO, { min?: number; max?: number; step?: number | "any" }>> = {
  effectifAlevinsParVague: { min: 1, step: 1 },
  margeSecuriteAlevinsPct: { min: 0, step: "any" },
  poidsMoyenInitialG: { min: 0, step: "any" },
  poidsObjectifG: { min: 0, step: "any" },
  prixAlevinUnitaireFCFA: { min: 0, step: "any" },
  prixVenteKgFCFA: { min: 0, step: "any" },
  nombreBacsSimultanesCible: { min: 1, step: 1 },
  frequenceStockageMois: { min: 0.1, step: 0.1 },
  tauxEpargnePct: { min: 0, max: 100, step: "any" },
  capaciteTransportAlimentsSacs: { min: 0, step: 1 },
  coutTransportAlimentsFCFA: { min: 0, step: "any" },
  capaciteTransportPoissonsKg: { min: 0, step: 1 },
  coutTransportPoissonsFCFA: { min: 0, step: "any" },
  capaciteTransportAlevinsNb: { min: 0, step: 1 },
  coutTransportAlevinsFCFA: { min: 0, step: "any" },
};

/** Champs de `CHAMPS` qui possedent une cle `previsions.parametresTab.fields.<key>.hint`. */
const CHAMPS_AVEC_HINT: Set<keyof ParametresPrevisionDTO> = new Set([
  "margeSecuriteAlevinsPct",
  "nombreBacsSimultanesCible",
  "tauxEpargnePct",
  // ADR-053 §14.4 : `prixAlevinUnitaireFCFA` reste TOUJOURS saisi, affiche,
  // editable — jamais masque, jamais desactive selon `alevinsAchetesParDefaut`.
  // Le hint est le seul mecanisme d'information contextuelle autorise ici.
  "prixAlevinUnitaireFCFA",
]);

/**
 * Ligne de saisie d'un palier — valeurs en CHAINES BRUTES, exactement comme
 * `values` pour les parametres ci-dessus, jamais des `number`.
 *
 * Un etat numerique impose un `Number(value)` a chaque frappe, ce qui rend la
 * saisie d'un decimal litteralement impossible : la frappe intermediaire "2."
 * (et "" pendant un effacement) devient `0`, donc le champ se reinitialise
 * avant que l'utilisateur ait pu taper la decimale. Depuis que le seuil est
 * exprime en TONNES (ERR-143) et non plus en sacs, 2,5 t est une valeur
 * parfaitement legitime : la conversion doit avoir lieu une seule fois, a
 * l'enregistrement (`handleSavePaliers`), comme pour les parametres.
 *
 * `id` sert uniquement de cle React (identifiant persiste ou temporaire) ;
 * `scenarioId`/`siteId` ne sont pas transportes : le PUT ne les envoie pas.
 */
interface PalierFormRow {
  id: string;
  seuilTonnes: string;
  pourcentageRemise: string;
  ordre: string;
}

/** Champs de `PalierFormRow` reellement editables (jamais `id`). */
type PalierFormField = "seuilTonnes" | "pourcentageRemise" | "ordre";

function toPalierRows(paliers: PalierRemiseDTO[]): PalierFormRow[] {
  return paliers.map((p) => ({
    id: p.id,
    seuilTonnes: String(p.seuilTonnes),
    pourcentageRemise: String(p.pourcentageRemise),
    ordre: String(p.ordre),
  }));
}

function toFormValues(p: ParametresPrevisionDTO | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!p) return result;
  for (const key of [...CHAMPS, ...CHAMPS_TRANSPORT]) {
    const v = p[key];
    result[key] = v === null || v === undefined ? "" : String(v);
  }
  result.tresorerieInitialeFCFA = p.tresorerieInitialeFCFA === null || p.tresorerieInitialeFCFA === undefined
    ? "0"
    : String(p.tresorerieInitialeFCFA);
  return result;
}

export function ParametresTab({ scenario, permissions, onDataChanged }: ParametresTabProps) {
  const t = useTranslations("previsions");
  const { put } = usePrevisionsApi();
  const peutParametrer = permissions.includes(Permission.PREVISIONS_PARAMETRER);

  const [values, setValues] = useState<Record<string, string>>(toFormValues(scenario.parametres));
  // Booleen — ne peut pas rejoindre `values` : la boucle generique de
  // `handleSaveParametres` applique `Number(raw)` uniformement a toute cle de
  // `CHAMPS`/`CHAMPS_TRANSPORT`, ce qui corromprait un booleen (ADR-053 §14).
  const [alevinsAchetesParDefaut, setAlevinsAchetesParDefaut] = useState(
    scenario.parametres?.alevinsAchetesParDefaut ?? false
  );
  const [saving, setSaving] = useState(false);
  const [paliers, setPaliers] = useState<PalierFormRow[]>(() => toPalierRows(scenario.paliersRemise));
  const [savingPaliers, setSavingPaliers] = useState(false);
  /**
   * Erreurs de validation des paliers renvoyees par l'API, indexees par le
   * `field` exact produit par zod : `paliers.<index>.<champ>` (cf. le
   * `.superRefine` de `replacePaliersRemiseSchema`, qui pose
   * `path: ["paliers", index, "ordre"]` pour un doublon d'ordre). Un refus
   * metier doit etre lisible AU POINT DE SAISIE : le doublon d'ordre est
   * volontairement refuse plutot que corrige en silence (voir `addPalier`),
   * ce qui n'a de sens que si l'utilisateur voit LEQUEL des champs Ordre est
   * en cause — un toast generique le laisserait deviner.
   */
  const [paliersFieldErrors, setPaliersFieldErrors] = useState<Record<string, string>>({});
  /** Compteur monotone des identifiants temporaires de paliers non encore persistes (voir `addPalier`). */
  const prochainIdTemporaire = useRef(0);
  /**
   * Erreurs de validation renvoyees par l'API (400, `errors: [{ field,
   * message }]`, cf. `parseBody` dans `src/app/api/previsions/_shared.ts`),
   * indexees par nom de champ — `useApi` affiche deja un toast generique
   * ("Erreurs de validation. <detail>"), mais sur un formulaire de 19 champs
   * l'utilisateur ne doit pas avoir a deviner LEQUEL est refuse : chaque
   * champ affiche son propre message, exactement comme `error` le fait deja
   * pour la validation client (R5/coherence avec les autres dialogues du
   * module qui font deja ce mapping, ex. `remise-form-dialog.tsx`).
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSaveParametres() {
    setSaving(true);
    setFieldErrors({});
    try {
      const body: Record<string, number | boolean> = {
        alevinsAchetesParDefaut,
      };
      for (const key of [...CHAMPS, ...CHAMPS_TRANSPORT]) {
        const raw = values[key];
        if (raw !== undefined && raw.trim() !== "") body[key] = Number(raw);
      }
      const rawTreso = values.tresorerieInitialeFCFA;
      if (rawTreso !== undefined && rawTreso.trim() !== "") {
        body.tresorerieInitialeFCFA = Number(rawTreso);
      }
      const result = await put(`/api/previsions/scenarios/${scenario.id}/parametres`, body);
      if (result.ok) {
        onDataChanged?.();
      } else if (result.errors) {
        const next: Record<string, string> = {};
        for (const e of result.errors) next[e.field] = e.message;
        setFieldErrors(next);
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Enregistre la frappe TELLE QUELLE (chaine), sans `Number()` : voir
   * `PalierFormRow`. La conversion est faite une seule fois, dans
   * `handleSavePaliers`.
   */
  function updatePalier(index: number, field: PalierFormField, value: string) {
    setPaliers((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    const cle = `paliers.${index}.${field}`;
    setPaliersFieldErrors((prev) => {
      if (!(cle in prev)) return prev;
      const next = { ...prev };
      delete next[cle];
      return next;
    });
  }

  /**
   * Ajoute un palier a la fin de la liste.
   *
   * `ordre` = max(ordres existants) + 1, JAMAIS `prev.length + 1` : apres la
   * suppression d'un palier au milieu (ordres 1, 2, 3 -> suppression du 2 ->
   * 1, 3), `prev.length + 1` valait 3, soit un DOUBLON de l'ordre 3 deja
   * present. Le defaut etait silencieux jusqu'a la contrainte
   * `@@unique([scenarioId, ordre])` (ADR-053 section 13.8 point 3), qui le
   * transforme en 409 "Cette valeur existe deja" — un message de base de
   * donnees dans une UI francaise.
   *
   * Choix : max + 1 a l'ajout, PLUTOT qu'une renumerotation systematique de
   * toute la liste a l'enregistrement. `ordre` est un champ saisissable :
   * renumeroter ecraserait silencieusement une numerotation deliberee de
   * l'utilisateur (et masquerait un doublon qu'il aurait saisi a la main dans
   * le champ Ordre, que seule une validation peut legitimement refuser). Les
   * doublons saisis manuellement sont donc refuses par un message metier
   * francais cote API (`replacePaliersRemiseSchema`, `replacePaliersRemise`),
   * pas corriges dans le dos de l'utilisateur.
   *
   * L'identifiant temporaire suit un compteur monotone pour la meme raison :
   * `nouveau-${prev.length}` pouvait collisionner apres une suppression, et
   * une cle React dupliquee corrompt le rendu de la liste.
   */
  function addPalier() {
    const id = `nouveau-${prochainIdTemporaire.current++}`;
    setPaliers((prev) => {
      const maxOrdre = prev.reduce((max, p) => Math.max(max, Number(p.ordre) || 0), 0);
      return [...prev, { id, seuilTonnes: "0", pourcentageRemise: "0", ordre: String(maxOrdre + 1) }];
    });
  }

  function removePalier(index: number) {
    setPaliers((prev) => prev.filter((_, i) => i !== index));
    /*
     * Les cles d'erreur sont POSITIONNELLES (`paliers.<index>.<champ>`) :
     * apres une suppression, les index restants glissent et une erreur
     * conservee designerait un autre palier que celui refuse. On les vide.
     */
    setPaliersFieldErrors({});
  }

  async function handleSavePaliers() {
    setSavingPaliers(true);
    setPaliersFieldErrors({});
    try {
      const result = await put(`/api/previsions/scenarios/${scenario.id}/paliers-remise`, {
        paliers: paliers.map((p) => ({
          seuilTonnes: Number(p.seuilTonnes),
          pourcentageRemise: Number(p.pourcentageRemise),
          ordre: Number(p.ordre),
        })),
      });
      if (result.ok) {
        onDataChanged?.();
      } else if (result.errors) {
        /*
         * Meme traitement que `handleSaveParametres` : les `errors` du 400
         * (`parseBody`, `src/app/api/previsions/_shared.ts`) sont restituees
         * au champ fautif. Sans ce mapping, le `.superRefine` du schema
         * produisait un `field: "paliers.<i>.ordre"` que personne ne lisait,
         * et l'utilisateur n'obtenait qu'un toast generique.
         */
        const next: Record<string, string> = {};
        for (const e of result.errors) next[e.field] = e.message;
        setPaliersFieldErrors(next);
      }
    } finally {
      setSavingPaliers(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormSection title={t("parametresTab.sectionTitle")} description={t("parametresTab.sectionDescription")}>
        {CHAMPS.map((key) => (
          <Input
            key={key}
            label={t(`parametresTab.fields.${key}.label`)}
            type="number"
            inputMode="decimal"
            min={CONTRAINTES[key]?.min}
            max={CONTRAINTES[key]?.max}
            step={CONTRAINTES[key]?.step}
            value={values[key] ?? ""}
            disabled={!peutParametrer}
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              setFieldErrors((prev) => {
                if (!(key in prev)) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }}
            error={fieldErrors[key]}
            hint={CHAMPS_AVEC_HINT.has(key) ? t(`parametresTab.fields.${key}.hint`) : undefined}
          />
        ))}
        <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={alevinsAchetesParDefaut}
            disabled={!peutParametrer}
            onChange={(e) => setAlevinsAchetesParDefaut(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">{t("parametresTab.fields.alevinsAchetesParDefaut.label")}</span>
        </label>
        <p className="text-xs text-muted-foreground">
          {t("parametresTab.fields.alevinsAchetesParDefaut.hint")}
        </p>
      </FormSection>

      <FormSection title={t("parametresTab.transportTitle")}>
        {CHAMPS_TRANSPORT.map((key) => (
          <Input
            key={key}
            label={t(`parametresTab.transportFields.${key}.label`)}
            type="number"
            inputMode="decimal"
            min={CONTRAINTES[key]?.min}
            max={CONTRAINTES[key]?.max}
            step={CONTRAINTES[key]?.step}
            value={values[key] ?? ""}
            disabled={!peutParametrer}
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              setFieldErrors((prev) => {
                if (!(key in prev)) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }}
            error={fieldErrors[key]}
          />
        ))}
      </FormSection>

      <FormSection
        title={t("parametresTab.tresorerieTitle")}
        description={scenario.scenarioParentId
          ? t("parametresTab.tresorerieChainee", { parentNom: scenario.scenarioParent?.nom ?? "" })
          : t("parametresTab.tresorerieDescription")
        }
      >
        <Input
          label={t("parametresTab.fields.tresorerieInitialeFCFA.label")}
          type="number"
          inputMode="decimal"
          step="any"
          value={values.tresorerieInitialeFCFA ?? "0"}
          disabled={!peutParametrer || !!scenario.scenarioParentId}
          onChange={(e) => {
            setValues((v) => ({ ...v, tresorerieInitialeFCFA: e.target.value }));
          }}
          error={fieldErrors.tresorerieInitialeFCFA}
          hint={scenario.scenarioParentId
            ? t("parametresTab.fields.tresorerieInitialeFCFA.hintChainee")
            : undefined
          }
        />
        {!scenario.scenarioParentId && peutParametrer && (
          <ImportTresorerieSelector
            scenarioId={scenario.id}
            onImport={(solde) => {
              setValues((v) => ({ ...v, tresorerieInitialeFCFA: String(solde) }));
            }}
          />
        )}
        {scenario.scenarioParent && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Link2 className="h-4 w-4 shrink-0" />
            <span>
              {t("parametresTab.chaineeDepuis", {
                code: scenario.scenarioParent.code,
                nom: scenario.scenarioParent.nom,
              })}
            </span>
          </div>
        )}
      </FormSection>

      {peutParametrer && (
        <Button onClick={handleSaveParametres} disabled={saving} className="w-full md:w-auto">
          {saving ? t("parametresTab.saving") : t("parametresTab.saveButton")}
        </Button>
      )}

      <FormSection
        title={t("parametresTab.paliers.title")}
        description={t("parametresTab.paliers.description")}
      >
        <div className="flex flex-col gap-3">
          {paliers.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">{t("parametresTab.paliers.palierLabel", { index: i + 1 })}</p>
                {peutParametrer && (
                  <button
                    type="button"
                    onClick={() => removePalier(i)}
                    className="flex h-11 w-11 items-center justify-center text-danger"
                    aria-label={t("parametresTab.paliers.removeAria")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label={t("parametresTab.paliers.seuilLabel")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  /*
                   * `step="any"` — meme convention que le bloc CONTRAINTES
                   * ci-dessus pour tout champ `nonNegativeNumber` cote zod.
                   * Le seuil est en TONNES (ERR-143) et la colonne Prisma est
                   * un Decimal : 2,5 t est legitime. Sans cet attribut, le
                   * `step=1` implicite du navigateur met "2.5" en :invalid.
                   */
                  step="any"
                  disabled={!peutParametrer}
                  error={paliersFieldErrors[`paliers.${i}.seuilTonnes`]}
                  value={p.seuilTonnes}
                  onChange={(e) => updatePalier(i, "seuilTonnes", e.target.value)}
                  /*
                   * Aide d'unite rappelee sur le PREMIER palier seulement :
                   * l'unite est la meme pour tous les paliers, la repeter sous
                   * chacun des 4 champs ajouterait 4 lignes de texte a une
                   * colonne de 360 px sans rien apprendre de plus. La regle
                   * complete (remise decidee une fois par vague, sur son
                   * tonnage vise) est portee par la description de la section,
                   * visible avant tous les paliers.
                   */
                  hint={i === 0 ? t("parametresTab.paliers.seuilHint") : undefined}
                />
                <Input
                  label={t("parametresTab.paliers.remiseLabel")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  /* Decimal cote Prisma, `z.number().min(0).max(100)` cote zod : 2,5 % est valide. */
                  step="any"
                  disabled={!peutParametrer}
                  error={paliersFieldErrors[`paliers.${i}.pourcentageRemise`]}
                  value={p.pourcentageRemise}
                  onChange={(e) => updatePalier(i, "pourcentageRemise", e.target.value)}
                />
                <Input
                  label={t("parametresTab.paliers.ordreLabel")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  /* `positiveInt` cote zod + colonne Int : pas de decimale ici. */
                  step={1}
                  disabled={!peutParametrer}
                  error={paliersFieldErrors[`paliers.${i}.ordre`]}
                  value={p.ordre}
                  onChange={(e) => updatePalier(i, "ordre", e.target.value)}
                />
              </div>
            </div>
          ))}
          {peutParametrer && (
            <Button variant="outline" onClick={addPalier}>
              <Plus className="h-4 w-4" />
              {t("parametresTab.paliers.addButton")}
            </Button>
          )}
          {peutParametrer && (
            <Button onClick={handleSavePaliers} disabled={savingPaliers}>
              {savingPaliers ? t("parametresTab.saving") : t("parametresTab.paliers.saveButton")}
            </Button>
          )}
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import trésorerie depuis un autre scénario (option 2)
// ---------------------------------------------------------------------------

interface ImportTresorerieProps {
  scenarioId: string;
  onImport: (soldeFinal: number) => void;
}

function ImportTresorerieSelector({ scenarioId, onImport }: ImportTresorerieProps) {
  const t = useTranslations("previsions");
  const { get } = usePrevisionsApi();
  const [scenarios, setScenarios] = useState<{ id: string; nom: string; code: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState<string | null>(null);

  async function loadScenarios() {
    if (scenarios) return;
    setLoading(true);
    try {
      const result = await get<{ data: { id: string; nom: string; code: string }[] }>("/api/previsions/scenarios");
      if (result.ok && result.data?.data) {
        setScenarios(
          result.data.data
            .filter((s: { id: string }) => s.id !== scenarioId)
            .map((s: { id: string; nom: string; code: string }) => ({
              id: s.id,
              nom: s.nom,
              code: s.code,
            }))
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(fromId: string) {
    setImportLoading(fromId);
    try {
      const result = await get<{ soldeFinalFCFA: number }>(`/api/previsions/scenarios/${fromId}/solde-final`);
      if (result.ok && result.data) {
        onImport(result.data.soldeFinalFCFA);
      }
    } finally {
      setImportLoading(null);
    }
  }

  if (!scenarios) {
    return (
      <Button variant="outline" size="sm" onClick={loadScenarios} disabled={loading}>
        {loading
          ? t("parametresTab.importTresorerie.chargement")
          : t("parametresTab.importTresorerie.bouton")}
      </Button>
    );
  }

  if (scenarios.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("parametresTab.importTresorerie.aucunScenario")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("parametresTab.importTresorerie.titre")}
      </p>
      {scenarios.map((s) => (
        <button
          key={s.id}
          onClick={() => handleImport(s.id)}
          disabled={importLoading !== null}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 transition-colors disabled:opacity-50 text-left"
        >
          <span>
            <span className="font-medium">{s.code}</span>
            <span className="text-muted-foreground ml-2">{s.nom}</span>
          </span>
          {importLoading === s.id && (
            <span className="text-xs text-muted-foreground">{t("parametresTab.importTresorerie.calcul")}</span>
          )}
        </button>
      ))}
    </div>
  );
}
