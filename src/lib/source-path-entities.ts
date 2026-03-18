// Source path entities for MAPPING mode custom placeholders.
// Shared between server (validation) and client (UI selectors).

export interface SourcePathField {
  path: string;
  label: string;
  type: "number" | "string";
}

export interface SourcePathEntity {
  key: string;
  label: string;
  fields: SourcePathField[];
}

export const SOURCE_PATH_ENTITIES: SourcePathEntity[] = [
  {
    key: "indicateurs",
    label: "Indicateurs de performance",
    fields: [
      { path: "indicateurs.fcr", label: "FCR (indice de conversion)", type: "number" },
      { path: "indicateurs.sgr", label: "SGR (taux de croissance)", type: "number" },
      { path: "indicateurs.tauxSurvie", label: "Taux de survie (%)", type: "number" },
      { path: "indicateurs.biomasse", label: "Biomasse totale (kg)", type: "number" },
      { path: "indicateurs.poidsMoyen", label: "Poids moyen (g)", type: "number" },
      { path: "indicateurs.nombreVivants", label: "Nombre vivants estime", type: "number" },
      { path: "indicateurs.tauxMortaliteCumule", label: "Mortalite cumulee (%)", type: "number" },
    ],
  },
  {
    key: "vague",
    label: "Vague",
    fields: [
      { path: "vague.code", label: "Code de la vague", type: "string" },
      { path: "vague.nombreInitial", label: "Nombre initial", type: "number" },
      { path: "vague.poidsMoyenInitial", label: "Poids moyen initial (g)", type: "number" },
    ],
  },
  {
    key: "cycle",
    label: "Cycle d'elevage",
    fields: [
      { path: "joursEcoules", label: "Jours ecoules", type: "number" },
      { path: "semaine", label: "Semaine du cycle", type: "number" },
      { path: "phase", label: "Phase d'elevage", type: "string" },
    ],
  },
  {
    key: "derniersReleves.qualite_eau",
    label: "Dernier releve qualite eau",
    fields: [
      { path: "derniersReleves.qualite_eau.temperature", label: "Temperature (°C)", type: "number" },
      { path: "derniersReleves.qualite_eau.ph", label: "pH", type: "number" },
      { path: "derniersReleves.qualite_eau.oxygene", label: "Oxygene dissous (mg/L)", type: "number" },
      { path: "derniersReleves.qualite_eau.ammoniac", label: "Ammoniac (mg/L)", type: "number" },
    ],
  },
  {
    key: "derniersReleves.biometrie",
    label: "Dernier releve biometrie",
    fields: [
      { path: "derniersReleves.biometrie.poidsMoyen", label: "Poids moyen releve (g)", type: "number" },
      { path: "derniersReleves.biometrie.tailleMoyenne", label: "Taille moyenne (cm)", type: "number" },
    ],
  },
  {
    key: "derniersReleves.alimentation",
    label: "Dernier releve alimentation",
    fields: [
      { path: "derniersReleves.alimentation.quantiteAliment", label: "Quantite aliment (g)", type: "number" },
    ],
  },
  {
    key: "derniersReleves.mortalite",
    label: "Dernier releve mortalite",
    fields: [
      { path: "derniersReleves.mortalite.nombreMorts", label: "Nombre de morts", type: "number" },
    ],
  },
  {
    key: "bac",
    label: "Bac courant",
    fields: [
      { path: "bac.nom", label: "Nom du bac", type: "string" },
      { path: "bac.volume", label: "Volume (L)", type: "number" },
      { path: "bac.nombrePoissons", label: "Nombre de poissons actuel", type: "number" },
      { path: "bac.nombreInitial", label: "Nombre initial dans le bac", type: "number" },
      { path: "bac.poidsMoyenInitial", label: "Poids moyen initial (g)", type: "number" },
    ],
  },
  {
    key: "configElevage",
    label: "Configuration d'elevage",
    fields: [
      { path: "configElevage.poidsObjectif", label: "Poids objectif (g)", type: "number" },
      { path: "configElevage.fcrAlerteMax", label: "FCR alerte max", type: "number" },
      { path: "configElevage.seuilAcclimatation", label: "Seuil acclimatation (g)", type: "number" },
      { path: "configElevage.seuilCroissanceDebut", label: "Seuil croissance debut (g)", type: "number" },
      { path: "configElevage.seuilJuvenile", label: "Seuil juvenile (g)", type: "number" },
      { path: "configElevage.seuilGrossissement", label: "Seuil grossissement (g)", type: "number" },
      { path: "configElevage.seuilFinition", label: "Seuil finition (g)", type: "number" },
    ],
  },
];

// Flat array derived from entities (used for backend validation)
export const ALLOWED_SOURCE_PATHS = SOURCE_PATH_ENTITIES.flatMap((e) => e.fields.map((f) => f.path));
