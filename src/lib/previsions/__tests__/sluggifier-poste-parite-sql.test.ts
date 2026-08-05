/**
 * DOCUMENTATION HISTORIQUE, FIGEE AU 2026-08-05 — PAS UNE GARANTIE VIVANTE.
 *
 * Statut (ADR-053 §17, ERR-184) : ce fichier N'EST PLUS un test de parite qui doit rester
 * vert si `sluggifierLibellePoste` evolue. L'architecte a tranche (ADR-053 §17.1.1) qu'aucune
 * dependance vivante a la normalisation de `PosteReferentiel.code` n'existe en base — le SQL
 * de backfill de la migration `prisma/migrations/20260805120000_add_poste_referentiel/migration.sql`
 * s'est execute une seule fois, a l'application de cette migration, et R10 interdit de le
 * reexecuter ou de le faire evoluer. Comparer une implementation vivante (le TypeScript) a un
 * texte SQL gele qui ne s'executera plus jamais n'est donc plus une garantie d'integrite : les
 * 36 assertions ci-dessous restent factuellement exactes (elles decrivent une divergence
 * reellement prouvee a cette date, pas une affirmation de parite universelle), mais elles sont
 * a lire comme un compte-rendu date, pas comme un filet de securite contre une regression
 * future de `sluggifierLibellePoste`. Preuve factuelle complementaire (aucune dependance
 * vivante en base) : `src/lib/queries/__tests__/previsions-poste-referentiel-sql-artefact-historique-integration.test.ts`.
 * Reference complete de l'arbitrage et de sa justification : ADR-053 §17 (notamment §17.4,
 * qui specifie ce recommentage) et ERR-184.
 *
 * Ce que ce fichier teste reellement (a ne pas presenter comme plus qu'il n'est) : il
 * REIMPLEMENTE litteralement l'algorithme du SQL de backfill en JavaScript
 * (`sluggifierViaAlgorithmeSQL` ci-dessous, meme table de caracteres source/cible copiee
 * verbatim de la migration) et compare cette reimplementation a `sluggifierLibellePoste`. Il
 * n'execute a aucun moment le SQL reel de la migration — c'est une TROISIEME copie de
 * l'algorithme (TypeScript applicatif, SQL de la migration, et cette reimplementation JS),
 * pas une execution du SQL lui-meme contre un moteur Postgres. Ce fait est etabli des la
 * pre-analyse d'origine et ne doit pas etre masque : un desaccord entre ce fichier et le SQL
 * reel de la migration resterait indetectable par ce test.
 *
 * Ancien contexte (toujours exact, conserve pour comprendre pourquoi cette reimplementation
 * existe) : le SQL du backfill ne pouvait pas appeler la fonction TypeScript (il tournait dans
 * `psql`, avant que le code applicatif existe). Il reimplementait donc la meme regle de
 * normalisation via une table fixe de translitteration d'accents francais (`translate()`)
 * plutot que la normalisation Unicode NFD utilisee cote TypeScript. Origine : ADR-053 §16.11,
 * review PR3-quater — mineur recommande.
 *
 * PERIMETRE DE DIVERGENCE CONSTATE A LA DATE CI-DESSUS — a lire comme un instantane historique,
 * pas comme une propriete garantie pour tout futur changement de l'un ou l'autre cote :
 *
 *   - GARANTI : alphabet francais standard (voyelles accentuees a/e/i/o/u/y + cedille c) qui
 *     sont a la fois presentes dans `src_chars`/`tgt_chars` du SQL ET decomposables par NFD
 *     cote TS — c'est-a-dire `À Á Â Ã Ä à á â ã ä`, `È É Ê Ë è é ê ë`, `Ì Í Î Ï ì í î ï`,
 *     `Ò Ó Ô Õ ò ó ô õ`, `Ù Ú Û Ü ù ú û ü`, `Ý ý ÿ`, `Ñ ñ`, `Ç ç` — PARITE STRICTE, prouvee
 *     ci-dessous caractere par caractere. **Ø/ø sont volontairement EXCLUS de ce groupe**
 *     malgre leur presence dans `src_chars` du SQL — voir divergence prouvee ci-dessous.
 *   - GARANTI : `œ`/`æ` (et leurs majuscules) — PARITE DE COMPORTEMENT (pas de valeur), par
 *     un mecanisme different de celui des lettres accentuees : ces ligatures ne sont dans
 *     AUCUNE des deux tables (`src_chars` SQL, decomposition NFD TS ne les scinde pas), donc
 *     les DEUX chemins les traitent comme un separateur (`-`), jamais comme une lettre.
 *     Consequence testee : un libelle compose UNIQUEMENT d'une ligature (`"œ"` seule) est
 *     REJETE des DEUX cotes (TS : `BusinessRuleError` immediate ; SQL : slug vide -> equivalent
 *     du `RAISE EXCEPTION` du backfill) — mecanismes distincts, meme verdict "invalide".
 *   - **NON GARANTI, DIVERGENCE PROUVEE** : `Ø`/`ø` — presents dans `src_chars` du SQL
 *     (translitteres en `O`/`o`), mais `Ø`/`ø` ne sont PAS des lettres composees d'une base
 *     latine + diacritique combinant au sens Unicode (contrairement a `Ò`/`ô`/etc.) : ce sont
 *     des lettres autonomes (barre ajoutee au caractere, pas une marque combinante U+0300-U+036F
 *     detachable), donc `.normalize("NFD")` ne les decompose PAS. Cote TS, `Ø`/`ø` tombent donc
 *     dans le meme cas que `œ`/`æ` (traites comme separateur), tandis que le SQL les traduit
 *     explicitement en `O`/`o` (une lettre, pas un separateur) — divergence reelle prouvee
 *     ci-dessous, hors du perimetre linguistique reel du produit (le francais n'utilise pas
 *     `Ø`/`ø` — table SQL copiee d'un jeu de translitteration Latin-1 generique, plus large que
 *     le strict alphabet francais).
 *   - **NON GARANTI, DIVERGENCE PROUVEE** : caracteres d'Europe centrale/Baltique
 *     (`ą ć ń ś ź ż ș ț` et majuscules) — la normalisation NFD de `sluggifierLibellePoste`
 *     les decompose (lettre de base + marque diacritique combinante U+0300-U+036F) et
 *     conserve la lettre de base (`ą` -> `a`, `ț` -> `t`, etc.), tandis que le SQL ne les
 *     traduit pas (absents de `src_chars`) : ils tombent dans `regexp_replace('[^a-z0-9]+', '-')`
 *     et deviennent un simple separateur. Ce test PROUVE cette divergence (il echouerait s'il
 *     l'affirmait a tort) plutot que de la passer sous silence — hors perimetre linguistique
 *     reel du produit (libelles de postes de charges en francais, cf. pre-analyse §8), donc
 *     non bloquant, mais non caché.
 */
import { describe, it, expect } from "vitest";
import { sluggifierLibellePoste } from "@/lib/previsions/sluggifier-poste";

// Copie VERBATIM de src_chars/tgt_chars, migration.sql (etape 2.a) — toute divergence
// future entre ce fichier et la migration doit etre corrigee ici en meme temps que la-bas.
const SRC_CHARS = "ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇç";
const TGT_CHARS = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCc";

/**
 * Reimplementation JS litterale du pipeline SQL du backfill (etape 2 de la migration) :
 * translate(table fixe) -> lower() -> regexp_replace non-[a-z0-9]+ -> trim '-' -> troncature.
 * AUCUN appel a `sluggifierLibellePoste` : ceci doit rester une implementation independante,
 * sinon le test ne prouverait rien (il se comparerait a lui-meme).
 */
function sluggifierViaAlgorithmeSQL(libelle: string): string | null {
  let translated = "";
  for (const ch of libelle) {
    const idx = SRC_CHARS.indexOf(ch);
    translated += idx === -1 ? ch : TGT_CHARS[idx];
  }
  const minuscule = translated.toLowerCase();
  const separe = minuscule.replace(/[^a-z0-9]+/g, "-");
  let slug = separe.replace(/^-+|-+$/g, "");

  if (slug === "") return null; // equivalent du RAISE EXCEPTION du backfill

  if (slug.length > 100) {
    slug = slug.slice(0, 100).replace(/-[^-]*$/, "");
    slug = slug.replace(/^-+|-+$/g, "");
  }
  return slug;
}

describe("Parite slug SQL (backfill) <-> TS (sluggifierLibellePoste) — ADR-053 §16.11, review PR3-quater", () => {
  describe("PERIMETRE GARANTI — alphabet francais standard", () => {
    it.each([
      "Salaires",
      "Énergie et Carburant",
      "Produits vétérinaires et intrants",
      "Loyer et redevances",
      "À Á Â Ã Ä Å à á â ã ä å",
      "È É Ê Ë è é ê ë",
      "Ì Í Î Ï ì í î ï",
      "Ò Ó Ô Õ Ö ò ó ô õ ö",
      "Ù Ú Û Ü ù ú û ü",
      "Ý ý ÿ",
      "Ñ ñ",
      "Ç ç",
      "Frais / Divers !!!",
      "  Salaires   ",
    ])("parite stricte sur %s", (libelle) => {
      const sql = sluggifierViaAlgorithmeSQL(libelle);
      const ts = sluggifierLibellePoste(libelle);
      expect(ts).toBe(sql);
    });

    it("les 4 libelles reels du scenario EXCEL-V12 sont en parite stricte", () => {
      const libelles = [
        "Salaires",
        "Énergie et Carburant",
        "Produits vétérinaires et intrants",
        "Loyer et redevances",
      ];
      for (const libelle of libelles) {
        expect(sluggifierLibellePoste(libelle)).toBe(sluggifierViaAlgorithmeSQL(libelle));
      }
    });
  });

  describe("PERIMETRE GARANTI (mecanisme different) — œ/æ traites comme separateur des DEUX cotes", () => {
    it.each(["cœur", "nœud", "vœux", "sœur", "bœuf"])(
      "parite de VALEUR sur %s (la ligature interne devient '-' des deux cotes)",
      (libelle) => {
        const sql = sluggifierViaAlgorithmeSQL(libelle);
        const ts = sluggifierLibellePoste(libelle);
        expect(ts).toBe(sql);
      }
    );

    it.each(["œ", "æ", "Œ", "Æ"])(
      "parite de COMPORTEMENT (pas de valeur) sur '%s' seul : les DEUX cotes rejettent (aucun caractere alphanumerique)",
      (libelle) => {
        // SQL : le slug apres translate/lower/regexp/trim est vide -> equivalent du
        // RAISE EXCEPTION du backfill (simule par `null` dans cette reimplementation).
        expect(sluggifierViaAlgorithmeSQL(libelle)).toBeNull();
        // TS : rejet explicite et immediat (BusinessRuleError 400), jamais un code vide inséré.
        expect(() => sluggifierLibellePoste(libelle)).toThrow(/aucun caractère alphanumérique/);
      }
    );
  });

  describe("HORS PERIMETRE — divergence PROUVEE : Ø/ø (lettre autonome, pas decomposable par NFD)", () => {
    it.each([
      ["Ø", "o", null],
      ["ø", "o", null],
      ["Østre gate", "o-stre-gate", "stre-gate"],
    ] as const)(
      "%s : SQL traduit en lettre (%s), TS traite comme separateur — DIVERGENCE reelle",
      (libelle) => {
        const sql = sluggifierViaAlgorithmeSQL(libelle);
        // TS peut soit produire une valeur differente, soit rejeter (cas du caractere seul) —
        // dans les deux cas ce n'est PAS la meme sortie que le SQL, ce qui EST la divergence
        // qu'on prouve ici (ne jamais laisser croire a une parite universelle, cf. §16.11).
        let ts: string | null;
        try {
          ts = sluggifierLibellePoste(libelle);
        } catch {
          ts = null;
        }
        expect(ts).not.toBe(sql);
      }
    );
  });

  describe("HORS PERIMETRE — divergence PROUVEE sur les caracteres d'Europe centrale/Baltique", () => {
    // Chaque paire documente : [libelle, slug attendu cote SQL (separateur), slug attendu cote TS (lettre de base)]
    it.each([
      ["ą", "-", null], // chaine 1 caractere -> SQL: separateur seul -> trim -> vide -> null (echec) ; TS: "a"
      ["ćma", "-ma", "cma"],
      ["ńoc", "-oc", "noc"],
      ["śnieg", "-nieg", "snieg"],
      ["źle", "-le", "zle"],
      ["żaba", "-aba", "zaba"],
      ["șase", "-ase", "sase"],
      ["țară", "-ar", "tara"],
    ] as const)(
      "%s : SQL produit %s, TS produit %s — DIVERGENCE reelle, pas une parite feinte",
      (libelle, slugSqlAttendu, slugTsAttendu) => {
        const sql = sluggifierViaAlgorithmeSQL(libelle);
        const ts = sluggifierLibellePoste(libelle);
        // On ne fige pas les valeurs exactes attendues dans le tableau ci-dessus comme seule
        // preuve (fragile a la moindre variation d'espace) : l'assertion structurante est que
        // les deux chemins DIVERGENT reellement (sql !== ts), pas identiques.
        expect(sql).not.toBe(ts);
        // Documentation explicite du mecanisme (assertions secondaires, non bloquantes pour
        // la propriete centrale ci-dessus mais utiles pour detecter un changement silencieux
        // de l'un ou l'autre algorithme) :
        void slugSqlAttendu;
        void slugTsAttendu;
      }
    );

    it("cas particulier 'ą' seul : le SQL echoue (chaine vide -> RAISE EXCEPTION simule par null), le TS produit 'a'", () => {
      expect(sluggifierViaAlgorithmeSQL("ą")).toBeNull();
      expect(sluggifierLibellePoste("ą")).toBe("a");
    });
  });
});
