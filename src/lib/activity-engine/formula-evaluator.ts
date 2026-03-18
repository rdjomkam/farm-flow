/**
 * formula-evaluator.ts — Evaluateur arithmetique securise pour les formules de placeholders.
 *
 * Parse et evalue des expressions arithmetiques simples avec references
 * a d'autres placeholders ou chemins du contexte.
 *
 * Operateurs supportes : + - * / ( )
 * Identifiants : references a des cles de placeholders resolus ou chemins contexte
 *
 * Securite : PAS de eval(), parsing recursif descendant maison.
 */

import type { RuleEvaluationContext } from "@/types/activity-engine";
import { resolveContextPath } from "./context-resolver";

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

enum TokenType {
  NUMBER,
  IDENTIFIER,
  PLUS,
  MINUS,
  MULTIPLY,
  DIVIDE,
  LPAREN,
  RPAREN,
  EOF,
}

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenise une expression en une liste de tokens.
 * @throws Error si un caractere invalide est rencontre
 */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number (integer or decimal)
    if (
      /[0-9]/.test(ch) ||
      (ch === "." &&
        i + 1 < expression.length &&
        /[0-9]/.test(expression[i + 1]))
    ) {
      let num = "";
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        num += expression[i];
        i++;
      }
      tokens.push({ type: TokenType.NUMBER, value: num });
      continue;
    }

    // Identifier (letters, digits, underscore, dot for path notation)
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < expression.length && /[a-zA-Z0-9_.]/.test(expression[i])) {
        id += expression[i];
        i++;
      }
      tokens.push({ type: TokenType.IDENTIFIER, value: id });
      continue;
    }

    // Operators and parentheses
    switch (ch) {
      case "+":
        tokens.push({ type: TokenType.PLUS, value: "+" });
        break;
      case "-":
        tokens.push({ type: TokenType.MINUS, value: "-" });
        break;
      case "*":
        tokens.push({ type: TokenType.MULTIPLY, value: "*" });
        break;
      case "/":
        tokens.push({ type: TokenType.DIVIDE, value: "/" });
        break;
      case "(":
        tokens.push({ type: TokenType.LPAREN, value: "(" });
        break;
      case ")":
        tokens.push({ type: TokenType.RPAREN, value: ")" });
        break;
      default:
        throw new Error(`Caractere invalide dans la formule: '${ch}'`);
    }
    i++;
  }

  tokens.push({ type: TokenType.EOF, value: "" });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent)
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos = 0;
  private resolvedStatic: Record<string, string>;
  private ctx: RuleEvaluationContext | null;

  constructor(
    tokens: Token[],
    resolvedStatic: Record<string, string>,
    ctx: RuleEvaluationContext | null
  ) {
    this.tokens = tokens;
    this.resolvedStatic = resolvedStatic;
    this.ctx = ctx;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private eat(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(
        `Token attendu: ${TokenType[type]}, recu: ${TokenType[token.type]} ('${token.value}')`
      );
    }
    this.pos++;
    return token;
  }

  /**
   * Grammar:
   *   expression = term (('+' | '-') term)*
   *   term       = factor (('*' | '/') factor)*
   *   factor     = NUMBER | IDENTIFIER | '(' expression ')' | ('-' | '+') factor
   */
  parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;

    while (
      this.current().type === TokenType.PLUS ||
      this.current().type === TokenType.MINUS
    ) {
      const op = this.current().type;
      this.pos++;
      const right = this.parseTerm();
      if (right === null) return null;
      left = op === TokenType.PLUS ? left + right : left - right;
    }

    return left;
  }

  private parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;

    while (
      this.current().type === TokenType.MULTIPLY ||
      this.current().type === TokenType.DIVIDE
    ) {
      const op = this.current().type;
      this.pos++;
      const right = this.parseFactor();
      if (right === null) return null;
      if (op === TokenType.DIVIDE) {
        if (right === 0) return null; // Division by zero → null
        left = left / right;
      } else {
        left = left * right;
      }
    }

    return left;
  }

  private parseFactor(): number | null {
    const token = this.current();

    // Unary minus/plus
    if (token.type === TokenType.MINUS) {
      this.pos++;
      const val = this.parseFactor();
      return val === null ? null : -val;
    }
    if (token.type === TokenType.PLUS) {
      this.pos++;
      return this.parseFactor();
    }

    // Number literal
    if (token.type === TokenType.NUMBER) {
      this.pos++;
      const num = parseFloat(token.value);
      return isNaN(num) ? null : num;
    }

    // Identifier — resolve from static placeholders or context
    if (token.type === TokenType.IDENTIFIER) {
      this.pos++;
      return this.resolveIdentifier(token.value);
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this.eat(TokenType.LPAREN);
      const val = this.parseExpression();
      this.eat(TokenType.RPAREN);
      return val;
    }

    throw new Error(
      `Token inattendu: ${TokenType[token.type]} ('${token.value}')`
    );
  }

  private resolveIdentifier(name: string): number | null {
    // 1. Try resolved static placeholders first
    const staticVal = this.resolvedStatic[name];
    if (staticVal != null && staticVal !== "[donnee non disponible]") {
      // Parse the formatted number (FR locale: "1 234,5" → 1234.5)
      const cleaned = staticVal.replace(/\s/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      if (!isNaN(num)) return num;
    }

    // 2. Try context path resolution
    if (this.ctx) {
      const ctxVal = resolveContextPath(name, this.ctx);
      if (typeof ctxVal === "number") return ctxVal;
      if (typeof ctxVal === "string") {
        const num = parseFloat(ctxVal);
        if (!isNaN(num)) return num;
      }
    }

    return null;
  }

  /** Expose current position for trailing-token check */
  getPos(): number {
    return this.pos;
  }

  /** Expose total token count for trailing-token check */
  getTokenCount(): number {
    return this.tokens.length;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evalue une formule arithmetique de maniere securisee.
 *
 * Les identifiants dans la formule sont resolus dans cet ordre :
 *   1. Placeholders statiques deja resolus (ex: "poids_moyen" → "185,3")
 *   2. Chemins dans le contexte d'evaluation (ex: "indicateurs.biomasse")
 *
 * @param formula        - Expression arithmetique (ex: "poids_moyen * 1.2")
 * @param resolvedStatic - Placeholders deja resolus (statiques + autres custom)
 * @param ctx            - Contexte d'evaluation (optionnel, pour les chemins)
 * @returns              Le resultat numerique ou null si la formule est invalide
 */
export function evaluateFormula(
  formula: string,
  resolvedStatic: Record<string, string>,
  ctx: RuleEvaluationContext | null = null
): number | null {
  if (!formula || typeof formula !== "string") return null;

  try {
    const tokens = tokenize(formula.trim());
    const parser = new Parser(tokens, resolvedStatic, ctx);
    const result = parser.parseExpression();

    // Ensure we consumed all tokens (except EOF)
    if (parser.getPos() < parser.getTokenCount() - 1) {
      return null; // Trailing tokens = invalid formula
    }

    if (result === null || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Valide la syntaxe d'une formule sans l'evaluer completement.
 * Utilise des valeurs factices pour les identifiants.
 *
 * @returns true si la formule est syntaxiquement valide
 */
export function validateFormulaSyntax(formula: string): boolean {
  if (!formula || typeof formula !== "string") return false;

  try {
    const tokens = tokenize(formula.trim());
    // Check that all identifiers can be parsed, use dummy values
    const dummyStatic: Record<string, string> = {};
    for (const token of tokens) {
      if (token.type === TokenType.IDENTIFIER) {
        dummyStatic[token.value] = "1";
      }
    }
    const parser = new Parser(tokens, dummyStatic, null);
    const result = parser.parseExpression();
    // Check all tokens consumed
    if (parser.getPos() < parser.getTokenCount() - 1) return false;
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Extrait les identifiants (references) utilises dans une formule.
 * Utile pour detecter les references circulaires.
 *
 * @returns Liste des identifiants trouves dans la formule
 */
export function extractFormulaIdentifiers(formula: string): string[] {
  if (!formula || typeof formula !== "string") return [];
  try {
    const tokens = tokenize(formula.trim());
    return tokens
      .filter((t) => t.type === TokenType.IDENTIFIER)
      .map((t) => t.value);
  } catch {
    return [];
  }
}
