"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export function SwRegister() {
  const [showUpdate, setShowUpdate] = useState(false);
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
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80">
      <div className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-lg">
        <RefreshCw className="h-5 w-5 shrink-0 text-teal-600" />
        <p className="flex-1 text-sm">Nouvelle version disponible</p>
        <button
          onClick={handleUpdate}
          className="shrink-0 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition-colors"
        >
          Mettre à jour
        </button>
        <button
          onClick={() => setShowUpdate(false)}
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
