const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak
} = require("docx");

// Colors
const PRIMARY = "0D6E3F";
const SECONDARY = "1A5276";
const ACCENT = "D4AC0D";
const LIGHT_BG = "F0F7F4";
const HEADER_BG = "0D6E3F";
const HEADER_BG2 = "1A5276";
const GRAY = "666666";
const LIGHT_GRAY = "F5F5F5";

const tBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellB = { top: tBorder, bottom: tBorder, left: tBorder, right: tBorder };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function headerCell(text, width, color = HEADER_BG) {
  return new TableCell({
    borders: cellB, width: { size: width, type: WidthType.DXA },
    shading: { fill: color, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20, font: "Arial" })] })]
  });
}

function dataCell(text, width, opts = {}) {
  const children = typeof text === "string"
    ? [new TextRun({ text, size: 20, font: "Arial", ...opts })]
    : text;
  return new TableCell({
    borders: cellB, width: { size: width, type: WidthType.DXA },
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children })]
  });
}

function bulletItem(ref, text, bold_prefix = null) {
  const children = [];
  if (bold_prefix) {
    children.push(new TextRun({ text: bold_prefix, bold: true, size: 20, font: "Arial" }));
    children.push(new TextRun({ text, size: 20, font: "Arial" }));
  } else {
    children.push(new TextRun({ text, size: 20, font: "Arial" }));
  }
  return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { before: 40, after: 40 }, children });
}

function heading1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "Arial" })] });
}

function heading2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, font: "Arial" })] });
}

function heading3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: "Arial" })] });
}

function para(text, opts = {}) {
  return new Paragraph({ spacing: { before: 80, after: 80 }, ...opts,
    children: [new TextRun({ text, size: 20, font: "Arial", ...(opts.run || {}) })] });
}

function paraRuns(runs, opts = {}) {
  return new Paragraph({ spacing: { before: 80, after: 80 }, ...opts,
    children: runs.map(r => typeof r === "string" ? new TextRun({ text: r, size: 20, font: "Arial" }) : new TextRun({ size: 20, font: "Arial", ...r })) });
}

function spacer() {
  return new Paragraph({ spacing: { before: 40, after: 40 }, children: [] });
}

function infoBox(text) {
  return new Table({
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 3, color: PRIMARY }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D5E8D4" }, left: { style: BorderStyle.SINGLE, size: 3, color: PRIMARY }, right: { style: BorderStyle.SINGLE, size: 1, color: "D5E8D4" } },
        shading: { fill: "E8F5E9", type: ShadingType.CLEAR },
        children: [new Paragraph({ spacing: { before: 100, after: 100 },
          children: [new TextRun({ text, size: 20, font: "Arial", italics: true, color: "2E7D32" })] })]
      })
    ] })]
  });
}

function noteBox(title, text) {
  return new Table({
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "F9E79F" }, left: { style: BorderStyle.SINGLE, size: 2, color: ACCENT }, right: { style: BorderStyle.SINGLE, size: 1, color: "F9E79F" } },
        shading: { fill: "FEF9E7", type: ShadingType.CLEAR },
        children: [
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: title, bold: true, size: 20, font: "Arial", color: "7D6608" })] }),
          new Paragraph({ spacing: { before: 40, after: 80 }, children: [new TextRun({ text, size: 20, font: "Arial", color: "7D6608" })] })
        ]
      })
    ] })]
  });
}

// ---- Build document ----

const numbering = {
  config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets2", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets3", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets4", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets5", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets6", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets7", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bullets8", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "num-modules", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "num-steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "num-steps2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "num-steps3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ]
};

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 48, bold: true, color: PRIMARY, font: "Arial" },
        paragraph: { spacing: { before: 0, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: PRIMARY, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: SECONDARY, font: "Arial" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "333333", font: "Arial" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering,
  sections: [
    // ===== PAGE DE GARDE =====
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DKFarm — FarmFlow", size: 16, color: GRAY, font: "Arial", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, font: "Arial", color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: GRAY }), new TextRun({ text: " / ", size: 16, font: "Arial", color: GRAY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: "Arial", color: GRAY })] })] }) },
      children: [
        spacer(), spacer(), spacer(), spacer(), spacer(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new TextRun({ text: "DKFARM — FARMFLOW", size: 28, bold: true, color: PRIMARY, font: "Arial" })] }),
        spacer(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
          children: [new TextRun({ text: "MODULE DE REPRODUCTION", size: 52, bold: true, color: PRIMARY, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
          children: [new TextRun({ text: "DES SILURES (Clarias gariepinus)", size: 36, bold: true, color: SECONDARY, font: "Arial" })] }),
        spacer(),
        // Ligne decorative
        new Table({ columnWidths: [9360], rows: [new TableRow({ children: [new TableCell({ borders: { top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 3, color: PRIMARY }, left: noBorder, right: noBorder }, children: [new Paragraph({ children: [] })] })] })] }),
        spacer(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: "Specification fonctionnelle a destination de l'ingenieur aquacole", size: 24, color: GRAY, font: "Arial", italics: true })] }),
        spacer(), spacer(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
          children: [new TextRun({ text: "Document de travail — Version 1.0", size: 20, color: GRAY, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
          children: [new TextRun({ text: "Date : 7 avril 2026", size: 20, color: GRAY, font: "Arial" })] }),
        spacer(), spacer(), spacer(),
        noteBox("OBJECTIF DE CE DOCUMENT",
          "Ce document decrit comment l'application FarmFlow va suivre numeriquement toutes les etapes de la reproduction des silures, depuis la gestion des geniteurs jusqu'a la production d'alevins de 7 a 15g. Il vous est adresse pour validation et amendements avant le debut du developpement informatique. Merci de noter vos remarques, corrections et suggestions directement sur ce document."),
      ]
    },

    // ===== SOMMAIRE + INTRO =====
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Module Reproduction — Specification fonctionnelle", size: 16, color: GRAY, font: "Arial", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, font: "Arial", color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: GRAY }), new TextRun({ text: " / ", size: 16, font: "Arial", color: GRAY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: "Arial", color: GRAY })] })] }) },
      children: [
        heading1("Sommaire"),
        spacer(),
        para("1. Introduction et vue d'ensemble"),
        para("2. Module 1 — Geniteurs (Gestion des reproducteurs)"),
        para("3. Module 2 — Pontes (Evenements de reproduction)"),
        para("4. Module 3 — Incubation"),
        para("5. Module 4 — Elevage larvaire (Phase vesicule vitelline)"),
        para("6. Module 5 — Nurserie (Premiere alimentation a 1g)"),
        para("7. Module 6 — Alevinage (1g a 7-15g)"),
        para("8. Module 7 — Tableau de bord et indicateurs"),
        para("9. Module 8 — Planification de la production"),
        para("10. Flux global et enchainement des etapes"),
        para("11. Questions ouvertes pour l'ingenieur"),
        spacer(),

        // ===== 1. INTRODUCTION =====
        heading1("1. Introduction et vue d'ensemble"),
        para("L'application FarmFlow integrera un module complet de suivi de la reproduction des silures (Clarias gariepinus). Ce module permettra a l'eleveur de suivre numeriquement, sur son telephone, chaque etape du processus de reproduction — depuis la gestion des geniteurs jusqu'a la vente ou le transfert des alevins de 7 a 15g vers les bacs de grossissement."),
        spacer(),
        paraRuns([
          { text: "Pourquoi c'est important : ", bold: true },
          "Notre recherche de terrain montre que la grande majorite des ecloseries en Afrique de l'Ouest ne tiennent aucun registre numerique de reproduction. Le resultat est une crise de consanguinite generalisee (deformites, mortalites massives, croissance retardee). FarmFlow sera le premier outil adapte au contexte africain pour resoudre ce probleme."
        ]),
        spacer(),

        heading2("Vue d'ensemble des 8 modules"),
        para("Le module Reproduction est compose de 8 sous-modules qui suivent le cycle naturel de production :"),
        spacer(),
        new Table({
          columnWidths: [600, 2400, 6360],
          rows: [
            new TableRow({ children: [
              headerCell("N", 600), headerCell("Module", 2400), headerCell("Ce qu'il fait", 6360)
            ] }),
            new TableRow({ children: [
              dataCell("1", 600, { bg: LIGHT_GRAY }), dataCell("Geniteurs", 2400, { bold: true, bg: LIGHT_GRAY }), dataCell("Gerer les reproducteurs males et femelles : qui ils sont, d'ou ils viennent, combien il en reste", 6360, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("2", 600), dataCell("Pontes", 2400, { bold: true }), dataCell("Enregistrer chaque evenement de reproduction : injection hormonale, stripping, fecondation", 6360)
            ] }),
            new TableRow({ children: [
              dataCell("3", 600, { bg: LIGHT_GRAY }), dataCell("Incubation", 2400, { bold: true, bg: LIGHT_GRAY }), dataCell("Suivre l'incubation des oeufs : substrat, traitements antifongiques, eclosion", 6360, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("4", 600), dataCell("Elevage larvaire", 2400, { bold: true }), dataCell("Phase vesicule vitelline (0-5 jours) : mortalite, conditions, transition vers alimentation", 6360)
            ] }),
            new TableRow({ children: [
              dataCell("5", 600, { bg: LIGHT_GRAY }), dataCell("Nurserie", 2400, { bold: true, bg: LIGHT_GRAY }), dataCell("Premiere alimentation jusqu'a 1g : alimentation, tri/calibrage, cannibalisme", 6360, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("6", 600), dataCell("Alevinage", 2400, { bold: true }), dataCell("Croissance de 1g a 7-15g : alimentation, biometrie, preparation a la vente/transfert", 6360)
            ] }),
            new TableRow({ children: [
              dataCell("7", 600, { bg: LIGHT_GRAY }), dataCell("Tableau de bord", 2400, { bold: true, bg: LIGHT_GRAY }), dataCell("Indicateurs cles : taux de fecondation, eclosion, survie, cout par alevin, alertes", 6360, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("8", 600), dataCell("Planification", 2400, { bold: true }), dataCell("Calendrier de production, previsions, rappels automatiques", 6360)
            ] }),
          ]
        }),
        spacer(),
        infoBox("Chaque module est connecte au suivant : les geniteurs alimentent les pontes, les pontes alimentent l'incubation, etc. L'application suit la tracabilite complete d'un lot depuis le geniteur jusqu'a l'alevin vendu."),

        // ===== 2. GENITEURS =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("2. Module 1 — Geniteurs"),
        para("Ce module gere l'ensemble des reproducteurs de la ferme. C'est le point de depart de tout le processus de reproduction."),
        spacer(),

        heading2("2.1 Deux modes de gestion au choix"),
        paraRuns([
          "L'application propose ",
          { text: "deux modes de gestion des geniteurs", bold: true },
          ", car les pratiques varient selon les fermes. Le fermier choisit son mode au moment de la configuration, mais peut utiliser les deux en parallele."
        ]),
        spacer(),

        heading3("Mode A — Gestion par groupe/bac (mode par defaut)"),
        paraRuns([
          "C'est la methode la plus repandue en Afrique. Les geniteurs sont geres ",
          { text: "par lot", bold: true },
          " (un groupe de poissons dans un meme bac), sans identification individuelle. C'est le mode recommande pour demarrer."
        ]),
        spacer(),
        para("Ce que l'application enregistre pour chaque lot de geniteurs :"),
        bulletItem("bullets", "Nom du lot (ex: \"Femelles Bac A\", \"Males Bac B\")"),
        bulletItem("bullets", "Bac assigne (quel bac contient ce lot)"),
        bulletItem("bullets", "Nombre de poissons dans le lot (males et femelles separes)"),
        bulletItem("bullets", "Poids moyen et fourchette de poids"),
        bulletItem("bullets", "Origine du lot : propre production, achat chez un autre fermier, capture sauvage, station de recherche"),
        bulletItem("bullets", "Date d'acquisition ou de constitution du lot"),
        bulletItem("bullets", "Generation estimee : G0 (sauvage), G1 (1ere generation), G2, G3+, ou \"inconnu\""),
        bulletItem("bullets", "Statut du lot : Actif / En repos / A reformer / Reforme"),
        bulletItem("bullets", "Historique : liste de toutes les pontes realisees avec ce lot"),
        spacer(),

        heading3("Mode B — Gestion individuelle (ecloseries avancees)"),
        para("Pour les fermes qui identifient chaque geniteur individuellement (par photo sur telephone, PIT tag, ou autre). L'application enregistre en plus :"),
        bulletItem("bullets2", "Code ou surnom unique du geniteur"),
        bulletItem("bullets2", "Photo de reference (prise avec le telephone)"),
        bulletItem("bullets2", "Sexe, poids actuel, origine et lignee parentale si connue"),
        bulletItem("bullets2", "Historique individuel complet : chaque ponte avec nombre d'oeufs, taux de fecondation, taux d'eclosion"),
        bulletItem("bullets2", "Nombre total de pontes (pour les femelles)"),
        bulletItem("bullets2", "Delai de repos entre les pontes (calcul automatique, minimum 6 semaines)"),
        bulletItem("bullets2", "Statut individuel : Actif / En repos / Reforme / Sacrifie (males) / Mort"),
        spacer(),

        heading3("Gestion specifique des males"),
        noteBox("POINT CLE A VALIDER",
          "Dans la pratique standard, les males de Clarias sont sacrifies pour extraire le sperme (les testicules sont prelevees). L'application gere donc les males comme des « consommables » avec un compteur decroissant. Une alerte previent quand le stock de males devient bas. Question : utilisez-vous aussi la methode chirurgicale non-letale (incision + seringue) ? Si oui, l'application permettra d'enregistrer les deux methodes."),
        spacer(),

        heading3("Alertes automatiques du module Geniteurs"),
        bulletItem("bullets3", "Alerte consanguinite : si tous les geniteurs viennent de la meme source depuis plus de 2 ans"),
        bulletItem("bullets3", "Alerte stock males bas : moins de X males disponibles (seuil configurable)"),
        bulletItem("bullets3", "Alerte surexploitation femelle : femelle utilisee plus de 8 fois par an ou repos < 6 semaines"),
        bulletItem("bullets3", "Alerte remplacement : lot en production depuis plus de 3 ans"),
        bulletItem("bullets3", "Rappel approvisionnement : suggestion de renouveler le stock genetique periodiquement"),
        spacer(),

        // ===== 3. PONTES =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("3. Module 2 — Pontes"),
        para("Ce module enregistre chaque evenement de reproduction, depuis l'injection hormonale jusqu'a la fecondation des oeufs. C'est le coeur du suivi de reproduction."),
        spacer(),

        heading2("3.1 Enregistrement d'une ponte (formulaire en 4 etapes)"),
        para("L'application guide l'utilisateur etape par etape :"),
        spacer(),

        heading3("Etape 1 — Selection des geniteurs"),
        bulletItem("bullets4", "Choisir la ou les femelles a utiliser (depuis un lot ou individuellement)"),
        bulletItem("bullets4", "Choisir le ou les males (avec indication du nombre qui sera sacrifie)"),
        bulletItem("bullets4", "Peser chaque femelle (obligatoire — sert a calculer la dose d'hormone)"),
        spacer(),

        heading3("Etape 2 — Injection hormonale"),
        bulletItem("bullets5", "Type d'hormone utilisee : Ovaprim, Ovatide, HCG, Hypophyse de silure (gratuite), Hypophyse de carpe, Hypophyse de tilapia, LHRH-a, Autre"),
        bulletItem("bullets5", "Dosage : l'application suggere automatiquement le dosage selon le poids de la femelle et le type d'hormone (ex: Ovaprim = 0,5 mL/kg)"),
        bulletItem("bullets5", "Cout de l'hormone utilisee (en FCFA)"),
        bulletItem("bullets5", "Date et heure de l'injection"),
        bulletItem("bullets5", "Heure estimee du stripping : calculee automatiquement selon la temperature de l'eau"),
        spacer(),
        infoBox("Exemple : injection a 18h avec eau a 27 C => l'application affiche \"Stripping prevu entre 3h et 4h du matin\" et envoie une notification-rappel."),
        spacer(),

        heading3("Etape 3 — Stripping et fecondation"),
        bulletItem("bullets6", "Heure reelle du stripping"),
        bulletItem("bullets6", "Poids des oeufs obtenus (en grammes)"),
        bulletItem("bullets6", "Nombre estime d'oeufs : calcul automatique (poids x 750 oeufs/gramme)"),
        bulletItem("bullets6", "Methode d'extraction du sperme : sacrifice ou chirurgical"),
        bulletItem("bullets6", "Test de motilite du sperme : OK ou Non viable"),
        bulletItem("bullets6", "Qualite visuelle des oeufs : Bonne / Moyenne / Mauvaise"),
        spacer(),

        heading3("Etape 4 — Resultat"),
        bulletItem("bullets7", "Taux de fecondation estime"),
        bulletItem("bullets7", "Bac d'incubation de destination"),
        bulletItem("bullets7", "Observations / anomalies"),
        spacer(),

        heading2("3.2 Fonctions complementaires"),
        bulletItem("bullets8", "Ponte echouee : possibilite d'enregistrer un echec avec la cause (femelle non mature, oeufs pateux, sperme non viable, stripping trop tot ou trop tard, probleme hormonal)"),
        bulletItem("bullets8", "Historique : liste de toutes les pontes filtrable par date, femelle, lot, resultat"),
        bulletItem("bullets8", "Duplication : copier les parametres d'une ponte reussie pour la suivante"),
        bulletItem("bullets8", "Cout par ponte : calcul automatique (hormone + amortissement geniteurs + male sacrifie)"),

        // ===== 4. INCUBATION =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("4. Module 3 — Incubation"),
        para("Ce module suit le developpement des oeufs fecondes jusqu'a l'eclosion des larves."),
        spacer(),

        heading2("4.1 Enregistrement"),
        bulletItem("bullets", "Lien automatique vers la ponte d'origine"),
        bulletItem("bullets", "Bac d'incubation utilise"),
        bulletItem("bullets", "Substrat d'incubation : racines de Pistia (laitue d'eau), jacinthes d'eau, plateaux perfores, eponges de ponte, brosses, kakaban, fond nu, autre"),
        bulletItem("bullets", "Nombre estime d'oeufs (pre-rempli depuis la ponte)"),
        bulletItem("bullets", "Temperature de l'eau"),
        bulletItem("bullets", "Heure de mise en incubation"),
        spacer(),

        heading2("4.2 Suivi en temps reel"),
        bulletItem("bullets2", "Compte a rebours automatique : l'application calcule l'heure d'eclosion prevue selon la temperature (20 C = ~40h, 25 C = ~30h, 30 C = ~22h)"),
        bulletItem("bullets2", "Notification push quand l'eclosion approche"),
        bulletItem("bullets2", "Registre des traitements antifongiques : type de produit (vert de malachite, bleu de methylene, peroxyde, sel), concentration, duree"),
        bulletItem("bullets2", "Retrait des oeufs morts : log avec quantite estimee"),
        spacer(),

        heading2("4.3 Resultat de l'eclosion"),
        bulletItem("bullets3", "Nombre de larves ecloses (comptage ou estimation)"),
        bulletItem("bullets3", "Taux d'eclosion : calcul automatique (larves / oeufs fecondes)"),
        bulletItem("bullets3", "Larves viables : apres retrait des deformees (environ 10-15% de deformees attendues)"),
        bulletItem("bullets3", "Transfert : vers quel bac larvaire, en quelle quantite"),
        spacer(),
        noteBox("QUESTION POUR L'INGENIEUR",
          "Quels substrats d'incubation utilisez-vous ou recommandez-vous dans notre contexte ? Y a-t-il des substrats locaux que nous n'avons pas listes ? Les seuils de taux d'eclosion proposes (bon > 50%, excellent > 65%) correspondent-ils a votre experience ?"),

        // ===== 5. ELEVAGE LARVAIRE =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("5. Module 4 — Elevage larvaire (0-5 jours)"),
        para("Ce module couvre la phase critique de la vesicule vitelline, entre l'eclosion et le debut de l'alimentation externe."),
        spacer(),

        heading2("5.1 Enregistrement"),
        bulletItem("bullets", "Lien vers l'incubation d'origine"),
        bulletItem("bullets", "Bac assigne et volume"),
        bulletItem("bullets", "Nombre de larves (pre-rempli)"),
        bulletItem("bullets", "Densite : calcul automatique (larves par litre)"),
        spacer(),

        heading2("5.2 Suivi quotidien"),
        para("Chaque jour, l'operateur enregistre sur son telephone :"),
        bulletItem("bullets2", "Mortalite du jour : nombre de larves mortes retirees"),
        bulletItem("bullets2", "Temperature de l'eau"),
        bulletItem("bullets2", "Nettoyage effectue : oui/non (siphonnage des detritus)"),
        bulletItem("bullets2", "Traitements appliques (preventifs)"),
        bulletItem("bullets2", "Observations libres (comportement, anomalies)"),
        spacer(),

        heading2("5.3 Transition vers la nurserie"),
        para("L'application propose une checklist pour valider le passage a l'etape suivante :"),
        bulletItem("bullets3", "Les larves nagent activement et cherchent de la nourriture"),
        bulletItem("bullets3", "La vesicule vitelline est visuellement resorbee"),
        bulletItem("bullets3", "Nombre de larves survivantes au moment du transfert"),
        bulletItem("bullets3", "Taux de survie de la phase larvaire : calcul automatique"),

        // ===== 6. NURSERIE =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("6. Module 5 — Nurserie (3 jours a ~6 semaines)"),
        paraRuns([
          "C'est la phase la plus critique en termes de pertes. Les larves passent de quelques milligrammes a environ 1 gramme. Le ",
          { text: "cannibalisme", bold: true },
          " est le facteur de mortalite numero 1 durant cette phase."
        ]),
        spacer(),

        heading2("6.1 Alimentation"),
        para("L'application guide l'operateur sur l'alimentation optimale selon l'age et le poids des alevins :"),
        spacer(),
        new Table({
          columnWidths: [2000, 2500, 2500, 2360],
          rows: [
            new TableRow({ children: [
              headerCell("Phase", 2000), headerCell("Type d'aliment", 2500), headerCell("Frequence", 2500), headerCell("Duree", 2360)
            ] }),
            new TableRow({ children: [
              dataCell("Alimentation vivante", 2000, { bg: LIGHT_GRAY }), dataCell("Artemia, zooplancton, oeuf dur", 2500, { bg: LIGHT_GRAY }),
              dataCell("6 a 12 repas/jour", 2500, { bg: LIGHT_GRAY }), dataCell("Jours 3 a 14", 2360, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("Sevrage", 2000), dataCell("Artemia + aliment sec progressif", 2500),
              dataCell("5 a 6 repas/jour", 2500), dataCell("Jours 10 a 25", 2360)
            ] }),
            new TableRow({ children: [
              dataCell("Sec exclusif", 2000, { bg: LIGHT_GRAY }), dataCell("Starter sec (42-47% proteine)", 2500, { bg: LIGHT_GRAY }),
              dataCell("4 a 6 repas/jour", 2500, { bg: LIGHT_GRAY }), dataCell("Jours 25+", 2360, { bg: LIGHT_GRAY })
            ] }),
          ]
        }),
        spacer(),
        para("Pour chaque jour, l'application enregistre : type d'aliment, quantite distribuee, frequence, taille des particules (suggeree automatiquement selon le poids moyen)."),
        spacer(),

        heading2("6.2 Tri et calibrage (anti-cannibalisme)"),
        paraRuns([
          { text: "Le tri regulier est la mesure la plus efficace contre le cannibalisme.", bold: true },
          " Sans tri, les pertes atteignent 40%. Avec un tri tous les 3 jours, les pertes descendent sous les 15%."
        ]),
        spacer(),
        para("L'application gere le tri comme suit :"),
        bulletItem("bullets", "Rappel automatique quand un tri est du (configurable : tous les 3, 5 ou 7 jours)"),
        bulletItem("bullets", "Enregistrement du tri : date, methode (tamis/grilles), nombre de classes de taille obtenues"),
        bulletItem("bullets", "Apres un tri, le lot se divise en sous-lots (gros / moyens / petits) affectes a differents bacs"),
        bulletItem("bullets", "Comptage par classe de taille"),
        bulletItem("bullets", "Retrait des « shooters » (gros sujets cannibales) : nombre retire"),
        spacer(),

        heading2("6.3 Mortalite et cannibalisme"),
        bulletItem("bullets2", "Mortalite confirmee : nombre de morts retires chaque jour"),
        bulletItem("bullets2", "Disparus (cannibalisme presume) : calcul automatique = initial - vivants - morts confirmes"),
        bulletItem("bullets2", "Taux de cannibalisme : calcul automatique, alerte si depasse 15%"),
        bulletItem("bullets2", "Taux de survie cumule : mis a jour en continu"),
        spacer(),

        heading2("6.4 Biometrie"),
        para("Pesees d'echantillons regulieres pour suivre la croissance :"),
        bulletItem("bullets3", "L'operateur pese un echantillon (ex: 20 alevins) et saisit le poids total"),
        bulletItem("bullets3", "L'application calcule le poids moyen et trace la courbe de croissance"),
        bulletItem("bullets3", "Le taux de croissance specifique (SGR) est calcule automatiquement entre deux pesees"),

        // ===== 7. ALEVINAGE =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("7. Module 6 — Alevinage (1g a 7-15g)"),
        para("Derniere phase avant la vente ou le transfert vers le grossissement. Les alevins grandissent de 1g a 7-15g en environ 4 a 8 semaines."),
        spacer(),

        heading2("7.1 Configuration du lot"),
        bulletItem("bullets", "Lien vers le lot de nurserie d'origine"),
        bulletItem("bullets", "Bac ou etang assigne"),
        bulletItem("bullets", "Nombre initial d'alevins"),
        bulletItem("bullets", "Poids moyen de depart"),
        bulletItem("bullets", "Objectif de poids cible : 7g, 10g ou 15g (configurable selon la demande du marche)"),
        spacer(),

        heading2("7.2 Alimentation"),
        para("L'application suit l'alimentation et calcule le FCR (indice de conversion alimentaire) :"),
        bulletItem("bullets2", "Type d'aliment : grower commercial (42-47% proteine) ou aliment local artisanal"),
        bulletItem("bullets2", "Taille du granule : suggeree selon le poids moyen (1-2 mm pour 1-5g, 2-3 mm pour 5-15g)"),
        bulletItem("bullets2", "Quantite distribuee par jour"),
        bulletItem("bullets2", "Frequence : 4-6 repas (1-5g) puis 3 repas (5-15g)"),
        bulletItem("bullets2", "FCR cumule : calcul automatique (aliment total / gain de poids total)"),
        spacer(),

        heading2("7.3 Suivi et sortie"),
        bulletItem("bullets3", "Mortalite quotidienne"),
        bulletItem("bullets3", "Biometrie periodique : pesee d'echantillon, courbe de croissance, croissance journaliere (g/jour)"),
        bulletItem("bullets3", "Tri : hebdomadaire puis bihebdomadaire"),
        bulletItem("bullets3", "Alerte croissance lente : si < 1,5 g/jour (seuil « mauvais » selon les references)"),
        spacer(),
        paraRuns([
          { text: "Sortie du lot : ", bold: true },
          "Quand le poids moyen atteint l'objectif, l'application notifie que le lot est pret. L'operateur enregistre la destination :"
        ]),
        bulletItem("bullets4", "Vente : lien vers le module de ventes (client, prix, quantite)"),
        bulletItem("bullets4", "Transfert vers grossissement : lien vers le module des vagues"),
        bulletItem("bullets4", "Transfert interne : vers un autre bac"),
        spacer(),
        paraRuns([
          { text: "A la sortie, l'application affiche le taux de survie global ", bold: true },
          "depuis la ponte d'origine, en chaine : ponte => incubation => larvaire => nurserie => alevinage. Cet indicateur permet de comparer les performances d'un lot a l'autre."
        ]),

        // ===== 8. DASHBOARD =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("8. Module 7 — Tableau de bord et indicateurs"),
        para("Le tableau de bord donne une vision globale et en temps reel de la performance de la reproduction. Il affiche des indicateurs cles (KPI) avec un systeme de couleurs : vert (bon), orange (a surveiller), rouge (alerte)."),
        spacer(),

        heading2("8.1 Indicateurs de reproduction"),
        new Table({
          columnWidths: [3200, 3200, 2960],
          rows: [
            new TableRow({ children: [
              headerCell("Indicateur", 3200), headerCell("Ce qu'il mesure", 3200), headerCell("Objectif", 2960)
            ] }),
            new TableRow({ children: [
              dataCell("Taux de fecondation", 3200, { bg: LIGHT_GRAY }), dataCell("% d'oeufs fecondes sur le total", 3200, { bg: LIGHT_GRAY }), dataCell("> 80%", 2960, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("Taux d'eclosion", 3200), dataCell("% de larves ecloses sur les oeufs fecondes", 3200), dataCell("> 50%", 2960)
            ] }),
            new TableRow({ children: [
              dataCell("Larves viables", 3200, { bg: LIGHT_GRAY }), dataCell("% de larves normales sur les ecloses", 3200, { bg: LIGHT_GRAY }), dataCell("> 85%", 2960, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("Fecondite relative", 3200), dataCell("Nombre d'oeufs par kg de femelle", 3200), dataCell("> 60 000", 2960)
            ] }),
          ]
        }),
        spacer(),

        heading2("8.2 Indicateurs de nurserie et alevinage"),
        new Table({
          columnWidths: [3200, 3200, 2960],
          rows: [
            new TableRow({ children: [
              headerCell("Indicateur", 3200), headerCell("Ce qu'il mesure", 3200), headerCell("Objectif", 2960)
            ] }),
            new TableRow({ children: [
              dataCell("Survie larvaire (0-14j)", 3200, { bg: LIGHT_GRAY }), dataCell("% de vivants apres 14 jours", 3200, { bg: LIGHT_GRAY }), dataCell("> 80%", 2960, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("Survie nurserie", 3200), dataCell("% de vivants de 14j a 1g", 3200), dataCell("> 70%", 2960)
            ] }),
            new TableRow({ children: [
              dataCell("Survie alevinage", 3200, { bg: LIGHT_GRAY }), dataCell("% de vivants de 1g a 15g", 3200, { bg: LIGHT_GRAY }), dataCell("> 80%", 2960, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("Survie globale", 3200), dataCell("Du debut (oeufs) a la fin (15g)", 3200), dataCell("> 25%", 2960)
            ] }),
            new TableRow({ children: [
              dataCell("Taux cannibalisme", 3200, { bg: LIGHT_GRAY }), dataCell("% de disparus (non morts confirmes)", 3200, { bg: LIGHT_GRAY }), dataCell("< 15%", 2960, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("FCR", 3200), dataCell("Kg aliment / Kg de gain de poids", 3200), dataCell("< 1,5", 2960)
            ] }),
            new TableRow({ children: [
              dataCell("Cout par alevin", 3200, { bg: LIGHT_GRAY }), dataCell("Total des couts / nombre d'alevins", 3200, { bg: LIGHT_GRAY }), dataCell("Variable", 2960, { bg: LIGHT_GRAY })
            ] }),
          ]
        }),
        spacer(),

        heading2("8.3 Alertes automatiques"),
        para("L'application genere des alertes en temps reel :"),
        bulletItem("bullets", "Consanguinite : geniteurs trop homogenes"),
        bulletItem("bullets", "Stock males bas"),
        bulletItem("bullets", "Femelle surexploitee"),
        bulletItem("bullets", "Survie critique : < 50% a n'importe quel stade"),
        bulletItem("bullets", "FCR degrade : > 2,5"),
        bulletItem("bullets", "Croissance en retard : lot stagnant depuis X jours"),
        spacer(),

        heading2("8.4 Graphiques"),
        bulletItem("bullets2", "Courbe en entonnoir (funnel) : survie d'un lot de la ponte a la vente"),
        bulletItem("bullets2", "Historique des pontes : timeline avec resultats"),
        bulletItem("bullets2", "Comparaison entre lots : superposition de courbes de performance"),
        bulletItem("bullets2", "Tendances : evolution des KPI sur 3, 6 et 12 mois"),
        spacer(),
        noteBox("QUESTION POUR L'INGENIEUR",
          "Les seuils d'alerte proposes (survie > 80%, FCR < 1,5, cannibalisme < 15%) correspondent-ils a ce que vous observez sur le terrain ? Faut-il ajuster ces valeurs pour notre contexte specifique (type de bac, alimentation disponible, temperature ambiante) ?"),

        // ===== 9. PLANIFICATION =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("9. Module 8 — Planification de la production"),
        para("Ce module aide a planifier et synchroniser les cycles de reproduction pour atteindre un objectif de production annuel."),
        spacer(),

        heading2("9.1 Calendrier de production"),
        bulletItem("bullets", "Vue calendrier : pontes planifiees, eclosions attendues, tris programmes, lots prets a la vente"),
        bulletItem("bullets", "Vue Gantt : tous les lots en cours avec leur phase actuelle (barre horizontale par lot)"),
        bulletItem("bullets", "Planification d'une ponte : en saisissant une date cible, l'application calcule les etapes en amont (conditionnement J-28, injection J-1, stripping J0)"),
        spacer(),

        heading2("9.2 Calculateur de production"),
        para("L'operateur saisit un objectif (ex: \"produire 100 000 alevins cette annee\") et l'application calcule :"),
        bulletItem("bullets2", "Nombre de pontes necessaires"),
        bulletItem("bullets2", "Nombre de femelles requises"),
        bulletItem("bullets2", "Nombre de males a prevoir (consommes)"),
        bulletItem("bullets2", "Quantite d'Artemia ou d'aliment vivant"),
        bulletItem("bullets2", "Surface de bacs/etangs necessaire"),
        spacer(),
        infoBox("Important : ces calculs sont bases sur les taux reels de la ferme (issus de l'historique), et non sur des moyennes theoriques. Plus la ferme utilise l'application, plus les previsions deviennent precises."),
        spacer(),

        heading2("9.3 Rappels et notifications"),
        bulletItem("bullets3", "Tri a effectuer : rappel selon la frequence configuree"),
        bulletItem("bullets3", "Commande d'Artemia : rappel quand le stock est bas"),
        bulletItem("bullets3", "Renouvellement de geniteurs : rappel annuel"),
        bulletItem("bullets3", "Ponte programmee : rappel J-2 et J-1"),
        bulletItem("bullets3", "Saisonnalite : conseils selon la saison (eau turbide apres fortes pluies, pic de demande debut des pluies)"),

        // ===== 10. FLUX GLOBAL =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("10. Flux global et enchainement des etapes"),
        para("Voici comment les 8 modules s'enchainent dans le cycle reel de production :"),
        spacer(),
        new Table({
          columnWidths: [1600, 2200, 2200, 1800, 1560],
          rows: [
            new TableRow({ children: [
              headerCell("Etape", 1600), headerCell("Module", 2200), headerCell("Duree", 2200), headerCell("Entree", 1800), headerCell("Sortie", 1560)
            ] }),
            new TableRow({ children: [
              dataCell("1", 1600, { bg: LIGHT_GRAY }), dataCell("Geniteurs", 2200, { bg: LIGHT_GRAY }),
              dataCell("2-4 sem. (conditionnement)", 2200, { bg: LIGHT_GRAY }), dataCell("Reproducteurs", 1800, { bg: LIGHT_GRAY }),
              dataCell("Femelles pretes", 1560, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("2", 1600), dataCell("Ponte", 2200),
              dataCell("~12h (injection a fecondation)", 2200), dataCell("Femelle + Male", 1800),
              dataCell("Oeufs fecondes", 1560)
            ] }),
            new TableRow({ children: [
              dataCell("3", 1600, { bg: LIGHT_GRAY }), dataCell("Incubation", 2200, { bg: LIGHT_GRAY }),
              dataCell("20-40h", 2200, { bg: LIGHT_GRAY }), dataCell("Oeufs fecondes", 1800, { bg: LIGHT_GRAY }),
              dataCell("Larves ecloses", 1560, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("4", 1600), dataCell("Elevage larvaire", 2200),
              dataCell("2-5 jours", 2200), dataCell("Larves", 1800),
              dataCell("Larves pret a manger", 1560)
            ] }),
            new TableRow({ children: [
              dataCell("5", 1600, { bg: LIGHT_GRAY }), dataCell("Nurserie", 2200, { bg: LIGHT_GRAY }),
              dataCell("3-5 semaines", 2200, { bg: LIGHT_GRAY }), dataCell("Larves", 1800, { bg: LIGHT_GRAY }),
              dataCell("Alevins ~1g", 1560, { bg: LIGHT_GRAY })
            ] }),
            new TableRow({ children: [
              dataCell("6", 1600), dataCell("Alevinage", 2200),
              dataCell("4-8 semaines", 2200), dataCell("Alevins 1g", 1800),
              dataCell("Alevins 7-15g", 1560)
            ] }),
          ]
        }),
        spacer(),
        paraRuns([
          { text: "Duree totale du cycle : ", bold: true },
          "10 a 14 semaines depuis l'injection hormonale jusqu'a l'alevin de 15g. Avec le conditionnement des geniteurs, compter 14 a 18 semaines."
        ]),
        spacer(),
        paraRuns([
          { text: "Nombre de cycles par an : ", bold: true },
          "5 a 8 en ecloserie controlee (temperature stable a 25 C), 2 a 3 en production saisonniere (etangs)."
        ]),

        // ===== 11. QUESTIONS =====
        new Paragraph({ children: [new PageBreak()] }),
        heading1("11. Questions ouvertes pour l'ingenieur"),
        para("Merci de repondre a ces questions pour nous aider a adapter l'application a notre contexte exact :"),
        spacer(),

        heading2("Sur les geniteurs"),
        new Paragraph({ numbering: { reference: "num-steps", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Combien de geniteurs gerez-vous actuellement (males et femelles) ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Utilisez-vous une methode d'identification des geniteurs ? Si oui, laquelle ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Pratiquez-vous la methode chirurgicale (non-letale) pour les males, ou uniquement le sacrifice ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "D'ou proviennent vos geniteurs actuels ? Renouvelez-vous le stock genetique ? A quelle frequence ?", size: 20, font: "Arial" })] }),
        spacer(),

        heading2("Sur les hormones et la ponte"),
        new Paragraph({ numbering: { reference: "num-steps2", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Quel type d'hormone utilisez-vous principalement ? Quel dosage ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps2", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Quel taux de fecondation obtenez-vous en moyenne ? Quel taux d'eclosion ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps2", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Quel substrat d'incubation utilisez-vous ? Pourquoi ce choix ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps2", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Y a-t-il d'autres hormones ou methodes locales que nous n'avons pas mentionnees ?", size: 20, font: "Arial" })] }),
        spacer(),

        heading2("Sur la nurserie et l'alevinage"),
        new Paragraph({ numbering: { reference: "num-steps3", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Quel premier aliment utilisez-vous pour les larves ? Artemia importee ou alternative locale ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps3", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "A quelle frequence triez-vous les alevins ? Utilisez-vous des tamis de taille specifique ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps3", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Quel taux de survie observez-vous de la ponte a l'alevin de 15g ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps3", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Combien de cycles de reproduction realisez-vous par an ?", size: 20, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "num-steps3", level: 0 }, spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "Y a-t-il des etapes, des donnees ou des alertes que vous aimeriez voir dans l'application et qui ne sont pas mentionnees dans ce document ?", size: 20, font: "Arial" })] }),
        spacer(), spacer(),

        // Zone de signature
        new Table({ columnWidths: [9360], rows: [new TableRow({ children: [new TableCell({ borders: { top: { style: BorderStyle.SINGLE, size: 2, color: PRIMARY }, bottom: { style: BorderStyle.SINGLE, size: 2, color: PRIMARY }, left: { style: BorderStyle.SINGLE, size: 2, color: PRIMARY }, right: { style: BorderStyle.SINGLE, size: 2, color: PRIMARY } }, shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, children: [
          new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "ESPACE POUR VOS AMENDEMENTS ET REMARQUES", bold: true, size: 22, font: "Arial", color: PRIMARY })] }),
          new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: "Date : ____________________", size: 20, font: "Arial" })] }),
          new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: "Nom : ____________________", size: 20, font: "Arial" })] }),
          new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: "Signature : ____________________", size: 20, font: "Arial" })] }),
          spacer(),
          new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: "Remarques generales :", size: 20, font: "Arial" })] }),
          spacer(), spacer(), spacer(), spacer(), spacer(), spacer(), spacer(), spacer(),
          new Paragraph({ spacing: { before: 40, after: 120 }, children: [new TextRun({ text: "_______________________________________________________________________________", size: 20, font: "Arial", color: GRAY })] }),
        ] })] })] }),
      ]
    }
  ]
});

const outputPath = "/Users/ronald/project/dkfarm/farm-flow/docs/FarmFlow-Module-Reproduction-Spec-v1.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log("Document genere : " + outputPath);
});
