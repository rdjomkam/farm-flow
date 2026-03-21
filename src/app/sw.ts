/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Background Sync types
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

declare global {
  interface ServiceWorkerGlobalScope {
    onsync: ((event: SyncEvent) => void) | null;
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Background Sync for offline queue
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "farmflow-offline-sync") {
    event.waitUntil(
      (async () => {
        // Import sync module dynamically is not possible in SW context
        // Instead, notify all clients to trigger sync
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({ type: "SYNC_REQUESTED" });
        }
      })()
    );
  }
});

// Handle SKIP_WAITING message from update banner
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
