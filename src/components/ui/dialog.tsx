"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
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
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 bg-card shadow-lg",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        // Mobile : plein écran
        "inset-0 rounded-none",
        // Desktop : centré avec max-width
        "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
        "md:max-w-lg md:w-full md:rounded-xl md:border md:border-border",
        "md:data-[state=open]:zoom-in-95 md:data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    >
      {/*
       * Inner layout: flex column capped at 85dvh.
       * - DialogHeader: non-scrollable, stays at top
       * - DialogBody (optional): flex-1 + overflow-y-auto for scrollable content
       * - DialogFooter: sticky at bottom with safe-area padding
       * Backward compatible: dialogs without DialogBody render children inline
       * in the flex column — no independent scroll, but layout is preserved.
       */}
      <div
        className={cn(
          "flex flex-col h-full md:max-h-[85dvh]",
          "px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-0"
        )}
      >
        {children}
      </div>
      <DialogPrimitive.Close className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] md:top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] min-w-[44px] flex items-center justify-center">
        <X className="h-5 w-5" />
        <span className="sr-only">Fermer</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 pt-4 pb-4 shrink-0 md:pt-6", className)}
      {...props}
    />
  );
}

/**
 * DialogBody — scrollable content area between header and footer.
 *
 * Wrap the main form or content of a dialog in this component to make it
 * independently scrollable while the header and footer stay sticky.
 *
 * Dialogs that do NOT use DialogBody remain fully backward compatible:
 * their content flows in the flex column without independent scrolling.
 */
function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto -mx-4 px-4 md:-mx-6 md:px-6", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title asChild>
      <h2
        className={cn("text-lg font-semibold leading-tight", className)}
        {...props}
      />
    </DialogPrimitive.Title>
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogPrimitive.Description asChild>
      <p
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    </DialogPrimitive.Description>
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-4 shrink-0",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        "sm:flex-row sm:justify-end",
        "md:pb-6",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
};
