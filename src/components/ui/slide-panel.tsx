"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SlidePanel — Panneau glissant depuis la droite, base sur Radix Dialog.
 * - Desktop (md+) : glisse depuis la droite, w-[480px]
 * - Mobile : plein ecran (fallback dialog centre)
 *
 * Safe areas iOS respectees (ERR-064) :
 * - Header : pt-[env(safe-area-inset-top)]
 * - Footer : pb-[max(0.75rem,env(safe-area-inset-bottom))]
 */

const SlidePanel = DialogPrimitive.Root;
const SlidePanelTrigger = DialogPrimitive.Trigger;
const SlidePanelClose = DialogPrimitive.Close;

const SlidePanelOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-overlay",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className
    )}
    {...props}
  />
));
SlidePanelOverlay.displayName = "SlidePanelOverlay";

interface SlidePanelContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
}

const SlidePanelContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SlidePanelContentProps
>(({ className, children, hideCloseButton = false, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SlidePanelOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile : plein ecran (dialog classique)
        "fixed inset-0 z-50 bg-card shadow-xl flex flex-col",
        // Desktop : panneau depuis la droite
        "md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:rounded-l-2xl md:border-l md:border-border",
        // Animations
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "md:data-[state=open]:slide-in-from-right",
        "md:data-[state=closed]:slide-out-to-right",
        "duration-200",
        className
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close
          className="absolute right-3 rounded-md p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] min-w-[44px] flex items-center justify-center z-10"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SlidePanelContent.displayName = "SlidePanelContent";

/**
 * SlidePanelHeader — zone header avec safe area top sur mobile.
 */
function SlidePanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-border px-4 py-4 shrink-0",
        "pt-[max(1rem,env(safe-area-inset-top))]",
        className
      )}
      {...props}
    />
  );
}

/**
 * SlidePanelBody — zone de contenu scrollable.
 */
function SlidePanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-4 py-4", className)}
      {...props}
    />
  );
}

/**
 * SlidePanelFooter — zone footer avec safe area bottom sur mobile.
 */
function SlidePanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border px-4 py-3 shrink-0",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  );
}

/**
 * SlidePanelTitle — titre accessible du panneau.
 */
const SlidePanelTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
SlidePanelTitle.displayName = "SlidePanelTitle";

/**
 * SlidePanelDescription — description accessible du panneau (sr-only si non visible).
 */
const SlidePanelDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SlidePanelDescription.displayName = "SlidePanelDescription";

export {
  SlidePanel,
  SlidePanelTrigger,
  SlidePanelClose,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelBody,
  SlidePanelFooter,
  SlidePanelTitle,
  SlidePanelDescription,
};
