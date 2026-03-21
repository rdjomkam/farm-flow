"use client";

import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function InstallPrompt() {
  const { canInstall, isIOS, isStandalone, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall || isStandalone) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80">
      <div className="rounded-lg border bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-teal-50 p-2">
            <Download className="h-5 w-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Installer FarmFlow</p>
            {isIOS ? (
              <p className="mt-1 text-xs text-gray-500">
                Appuyez sur{" "}
                <Share className="inline h-3.5 w-3.5 text-blue-500" />{" "}
                puis &quot;Sur l&apos;écran d&apos;accueil&quot;
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Accédez rapidement à l&apos;app depuis votre écran d&apos;accueil
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-gray-400 hover:text-gray-600"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!isIOS && (
          <button
            onClick={promptInstall}
            className="mt-3 w-full rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            Installer
          </button>
        )}
      </div>
    </div>
  );
}
