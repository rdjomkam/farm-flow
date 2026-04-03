"use client";

import { createContext, useCallback, useContext, useState } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const variants = {
  default: "border-border bg-card text-card-foreground",
  success: "border-success/30 bg-card text-success",
  error: "border-danger/30 bg-card text-danger",
  info: "border-primary/30 bg-card text-primary",
};

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: keyof typeof variants;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const t = useTranslations("common");

  const toast = useCallback((props: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...props, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={2000}>
        {children}
        {toasts.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            duration={2000}
            className={cn(
              "group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-top-full",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
              "data-[swipe=cancel]:translate-x-0 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
              "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
              variants[item.variant ?? "default"]
            )}
            onOpenChange={(open) => {
              if (!open) removeToast(item.id);
            }}
          >
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-1 text-sm opacity-80">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close aria-label={t("buttons.close")} className="rounded-md p-1 opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext>
  );
}
