"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Texte d'aide contextuelle affiché sous le champ et lié via aria-describedby */
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id: idProp, required, type, onWheel, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    /*
     * `aria-describedby` ne doit JAMAIS referencer un id qui n'est pas rendu :
     * un lecteur d'ecran qui suit une reference morte n'annonce rien, et
     * l'attribut donne l'illusion d'une description existante. Le hint n'est
     * rendu que si `!error` (voir plus bas : l'erreur remplace l'aide, elle ne
     * s'y ajoute pas) — la condition ici doit donc etre STRICTEMENT la meme,
     * sans quoi tout appelant fournissant a la fois `hint` et `error` (cas
     * desormais atteignable sur le premier palier de remise de
     * `parametres-tab.tsx`, qui porte un hint d'unite ET peut recevoir une
     * erreur de champ renvoyee par l'API) pointerait vers un id inexistant.
     */
    const describedBy = [
      error ? errorId : null,
      hint && !error ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        <input
          id={id}
          type={type}
          className={cn(
            "flex h-11 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[44px]",
            error ? "border-danger" : "border-border",
            className
          )}
          ref={ref}
          required={required}
          aria-required={required ? "true" : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          onWheel={(e) => {
            // La molette de souris/trackpad au-dessus d'un champ numerique
            // focus incremente/decremente sa valeur silencieusement (piege
            // classique) — on retire le focus AVANT que le navigateur
            // n'applique son comportement natif, ce qui neutralise le
            // changement de valeur sans jamais appeler preventDefault() :
            // le defilement de la PAGE continue normalement, seul le champ
            // perd le focus. Ne s'applique qu'aux champs type="number".
            if (type === "number") {
              e.currentTarget.blur();
            }
            onWheel?.(e);
          }}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" aria-live="polite" className="text-sm text-danger">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, type InputProps };
