"use client";

import { useCallback, type ComponentPropsWithoutRef } from "react";
import type { DialogContent } from "@/components/ui/dialog";

/**
 * src/hooks/use-dialog-close-guard.ts
 *
 * Garde de fermeture partagee pour les dialogues de saisie du module
 * Previsions (Sprint PR2-ter, story PR2ter.2, Bug A — pre-analyse section 3).
 *
 * Constat : sous Radix, un clic hors du `DialogContent` ou la touche Echap
 * appellent tous les deux `onOpenChange(false)` via le meme mecanisme
 * (`DismissableLayer`), sans jamais avertir l'utilisateur qu'une saisie en
 * cours va etre perdue. Ce hook expose deux handlers a spreader directement
 * sur `<DialogContent>` : ils bloquent la fermeture (via `preventDefault`)
 * uniquement si le formulaire a ete touche (`isDirty`), jamais sur un
 * dialogue encore vierge — pour ne pas reintroduire de friction sur le cas
 * nominal "ouvrir puis fermer sans rien saisir".
 *
 * Volontairement PAS un composant `FormDialog` generique (pre-analyse
 * section 4) : les 10 dialogues du module n'ont pas une forme homogene
 * (etat par champ vs objet `form`, flux multi-etapes, dialogues sans
 * `DialogTrigger`...). Ce hook se contente d'exposer la logique de garde,
 * reutilisable sans imposer de structure.
 *
 * Le bouton Annuler et la croix de fermeture (`DialogClose`) restent
 * TOUJOURS fonctionnels : ce hook ne s'applique qu'aux deux interactions
 * Radix concernees (clic exterieur, touche Echap), jamais aux actions
 * explicites de fermeture — le garde ne doit jamais piegier l'utilisateur
 * dans un dialogue impossible a fermer.
 */

type OnInteractOutside = NonNullable<ComponentPropsWithoutRef<typeof DialogContent>["onInteractOutside"]>;
type OnEscapeKeyDown = NonNullable<ComponentPropsWithoutRef<typeof DialogContent>["onEscapeKeyDown"]>;

export interface DialogCloseGuard {
  onInteractOutside: OnInteractOutside;
  onEscapeKeyDown: OnEscapeKeyDown;
}

export function useDialogCloseGuard(isDirty: boolean): DialogCloseGuard {
  const onInteractOutside = useCallback<OnInteractOutside>(
    (event) => {
      if (isDirty) event.preventDefault();
    },
    [isDirty]
  );

  const onEscapeKeyDown = useCallback<OnEscapeKeyDown>(
    (event) => {
      if (isDirty) event.preventDefault();
    },
    [isDirty]
  );

  return { onInteractOutside, onEscapeKeyDown };
}
