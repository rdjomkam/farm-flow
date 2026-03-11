"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteInfo {
  id: string;
  name: string;
}

interface SiteSelectorProps {
  fullWidth?: boolean;
}

export function SiteSelector({ fullWidth }: SiteSelectorProps) {
  const router = useRouter();
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/sites").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
    ]).then(([sitesData, meData]) => {
      if (sitesData?.sites) setSites(sitesData.sites);
      if (meData?.user?.activeSiteId) setActiveSiteId(meData.user.activeSiteId);
    });
  }, []);

  async function handleSwitch(siteId: string) {
    if (siteId === activeSiteId) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/auth/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      if (res.ok) {
        setActiveSiteId(siteId);
        router.refresh();
      }
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  }

  const activeSite = sites.find((s) => s.id === activeSiteId);

  if (sites.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
          "hover:bg-muted transition-colors",
          "min-h-[36px]",
          "disabled:opacity-50",
          fullWidth && "w-full"
        )}
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn(
          "truncate font-medium",
          fullWidth ? "flex-1 text-left" : "max-w-[80px] sm:max-w-[140px]"
        )}>
          {activeSite?.name ?? "Choisir un site"}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-card shadow-md py-1">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => handleSwitch(site.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left",
                  "hover:bg-muted transition-colors",
                  "min-h-[44px]",
                  site.id === activeSiteId && "bg-primary/10 text-primary font-medium"
                )}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{site.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
