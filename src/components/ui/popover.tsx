"use client";

/**
 * src/components/ui/popover.tsx
 *
 * Wrapper Radix Popover — premiere utilisation de `@radix-ui/react-popover`
 * dans le depot (Sprint PR2, story PR2.3). Ajoutee explicitement a
 * `package.json` (jamais laissee transitive), suivant le precedent
 * `decimal.js` (ADR-053 §7).
 *
 * Choix Popover plutot que Tooltip (pre-analyse PR2.3 §2) : l'exigence §7.4
 * dit "clic OU survol" — un Tooltip Radix ne gere que le survol/focus, pas
 * le clic-pour-rester-ouvert necessaire sur mobile ou il n'y a pas de hover.
 * Radix Popover gere nativement les deux (bouton declencheur + contenu qui
 * reste ouvert au clic, se ferme au clic exterieur/Echap).
 *
 * Marge de collision (correctif post-livraison, campagne de rendu reel
 * Chromium PR2-quinquies, 375px) : sans `collisionPadding`, Radix positionne
 * le contenu au ras du bord du viewport quand le declencheur est pres du
 * bord droit — le popover mesurait `right = 375` exactement, colle au bord.
 * `collisionPadding = 16` (defaut, surchargeable par prop) force une marge
 * minimale entre le contenu et les bords du viewport, quel que soit le
 * declencheur.
 */
import { forwardRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, collisionPadding = 16, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 shadow-lg outline-none",
        "text-sm text-foreground",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
