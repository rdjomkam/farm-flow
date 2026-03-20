"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Users, Container, Waves, Plus, Check } from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  memberCount: number;
  bacCount: number;
  vagueCount: number;
  createdAt: Date;
}

interface Props {
  sites: SiteData[];
  activeSiteId: string | null;
  canCreate: boolean;
}

export function SitesListClient({ sites, activeSiteId, canCreate }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(address.trim() && { address: address.trim() }),
        }),
      });

      if (res.ok) {
        const site = await res.json();
        toast({ title: "Site cree avec succes", variant: "success" });
        setDialogOpen(false);
        setName("");
        setAddress("");

        // Auto-select the new site
        await fetch("/api/auth/site", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: site.id }),
        });

        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la creation", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function handleSelect(siteId: string) {
    if (siteId === activeSiteId) return;

    setSwitching(siteId);
    try {
      const res = await fetch("/api/auth/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });

      if (res.ok) {
        toast({ title: "Site selectionne", variant: "success" });
        router.push("/");
        router.refresh();
      }
    } catch {
      toast({ title: "Erreur lors de la selection", variant: "error" });
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sites.length} site{sites.length > 1 ? "s" : ""}
        </p>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Creer un site</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label="Nom du site"
                  placeholder="Ex: Ferme de Douala"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Adresse (optionnel)"
                  placeholder="Ex: Douala, Cameroun"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                  {creating ? <><FishLoader size="sm" /> Creation...</> : "Creer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Aucun site</p>
          <p className="text-sm text-muted-foreground">
            {canCreate
              ? "Creez votre premier site pour commencer."
              : "Demandez a un administrateur de vous ajouter a un site."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sites.map((site) => (
            <Card
              key={site.id}
              className={cn(
                "transition-colors",
                site.id === activeSiteId && "ring-2 ring-primary"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold truncate">{site.name}</h3>
                      {site.id === activeSiteId && (
                        <span className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
                          <Check className="h-3 w-3" />
                          Actif
                        </span>
                      )}
                    </div>
                    {site.address && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {site.address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {site.memberCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Container className="h-4 w-4" />
                    {site.bacCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Waves className="h-4 w-4" />
                    {site.vagueCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={site.id === activeSiteId ? "outline" : "primary"}
                    onClick={() => handleSelect(site.id)}
                    disabled={switching === site.id || site.id === activeSiteId}
                    className="flex-1"
                  >
                    {switching === site.id
                      ? "Selection..."
                      : site.id === activeSiteId
                        ? "Site actif"
                        : "Selectionner"}
                  </Button>
                  <Link href={`/settings/sites/${site.id}`}>
                    <Button size="sm" variant="outline">
                      Gerer
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
