"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";

export function SwRegister() {
  const t = useTranslations("pwa");
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setShowUpdate(true);
          return;
        }

        // Listen for new installations
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setShowUpdate(true);
            }
          });
        });
      })
      .catch((err) => {
        console.error("SW registration failed:", err);
      });

    // Handle controller change (after SKIP_WAITING)
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      setIsUpdating(true);
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      // Fallback reload if controllerchange never fires
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
        <RefreshCw className={`h-5 w-5 shrink-0 text-primary${isUpdating ? " animate-spin" : ""}`} />
        <p className="flex-1 text-sm">
          {isUpdating ? t("swRegister.miseAJour") : t("swRegister.nouvelleVersion")}
        </p>
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUpdating ? t("swRegister.miseAJour") : t("swRegister.mettreAJour")}
        </button>
        <button
          onClick={() => setShowUpdate(false)}
          disabled={isUpdating}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t("swRegister.fermer")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
