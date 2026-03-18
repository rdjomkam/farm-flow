"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  KNOWN_PLACEHOLDERS,
  validateTemplatePlaceholders,
  validateTemplatePlaceholdersWithCustom,
  getAllPlaceholders,
} from "@/lib/regles-activites-constants";

// First 6 placeholders shown by default (most commonly used)
const INITIAL_VISIBLE = 6;

interface TemplateEditorProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  /** Custom placeholders loaded from DB (optional) */
  customPlaceholders?: { key: string; label: string; description: string | null; example: string }[];
}

/**
 * Textarea augmentee avec chips de placeholders cliquables.
 *
 * - Affiche les 6 premiers placeholders par defaut
 * - Un bouton "Voir tous" revele le reste via toggle simple
 * - Le clic sur un chip insere {key} a la position du curseur dans le textarea
 * - Avertissement non-bloquant si des placeholders inconnus sont detectes
 */
export function TemplateEditor({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
  required = false,
  maxLength,
  customPlaceholders = [],
}: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAll, setShowAll] = useState(false);

  // Merge static + custom placeholders
  const allPlaceholders = getAllPlaceholders(customPlaceholders);
  const customKeys = customPlaceholders.map((cp) => cp.key);

  // Validate placeholders for warning display (including custom keys)
  const { valid, unknown } = customKeys.length > 0
    ? validateTemplatePlaceholdersWithCustom(value, customKeys)
    : validateTemplatePlaceholders(value);

  // Static placeholders shown first, then custom
  const staticPlaceholders = allPlaceholders.filter((p) => !(p as { isCustom?: boolean }).isCustom);
  const customOnly = allPlaceholders.filter((p) => (p as { isCustom?: boolean }).isCustom);

  const visibleStaticPlaceholders = showAll
    ? staticPlaceholders
    : staticPlaceholders.slice(0, INITIAL_VISIBLE);

  function insertPlaceholder(key: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const insertion = `{${key}}`;
    const newValue = value.slice(0, start) + insertion + value.slice(end);
    onChange(newValue);

    // Restore focus and cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursor = start + insertion.length;
      textarea.setSelectionRange(newCursor, newCursor);
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>

      <Textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-[44px]"
      />

      {/* Character count */}
      {maxLength && (
        <p className="text-xs text-muted-foreground text-right">
          {value.length}/{maxLength}
        </p>
      )}

      {/* Unknown placeholder warning — non-blocking */}
      {!valid && (
        <p className="text-xs text-warning">
          Placeholders non reconnus : {unknown.map((k) => `{${k}}`).join(", ")} — ils seront remplace par &quot;[donnee non disponible]&quot;.
        </p>
      )}

      {/* Placeholder chips */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Placeholders systeme :
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visibleStaticPlaceholders.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.description}
              onClick={() => insertPlaceholder(p.key)}
              className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-mono text-primary hover:bg-primary/20 transition-colors min-h-[32px]"
            >
              {`{${p.key}}`}
            </button>
          ))}
        </div>

        {staticPlaceholders.length > INITIAL_VISIBLE && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Masquer
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Voir tous ({staticPlaceholders.length - INITIAL_VISIBLE} de plus)
              </>
            )}
          </button>
        )}

        {/* Custom placeholder chips */}
        {customOnly.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mt-2">
              Placeholders personnalises :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {customOnly.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  title={p.description}
                  onClick={() => insertPlaceholder(p.key)}
                  className="inline-flex items-center rounded-md bg-accent/20 px-2 py-1 text-xs font-mono text-accent-foreground hover:bg-accent/30 transition-colors min-h-[32px] border border-accent/30"
                >
                  {`{${p.key}}`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
