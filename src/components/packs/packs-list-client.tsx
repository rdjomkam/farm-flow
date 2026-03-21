"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Package, CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useConfigService } from "@/services";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission } from "@/types";

interface PackData {
  id: string;
  nom: string;
  description: string | null;
  nombreAlevins: number;
  poidsMoyenInitial: number;
  prixTotal: number;
  isActive: boolean;
  configElevage: { id: string; nom: string } | null;
  user: { id: string; name: string };
  produits: Array<{
    id: string;
    quantite: number;
    produit: { id: string; nom: string; categorie: string; unite: string; prixUnitaire: number };
  }>;
  _count: { activations: number };
}

interface PlanOption {
  id: string;
  nom: string;
  typePlan: string;
}

interface Props {
  packs: PackData[];
  permissions: Permission[];
  plans?: PlanOption[];
}

export function PacksListClient({ packs, permissions, plans = [] }: Props) {
  const router = useRouter();
  const configService = useConfigService();
  const [tab, setTab] = useState("actifs");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [nombreAlevins, setNombreAlevins] = useState("");
  const [poidsMoyen, setPoidsMoyen] = useState("5");
  const [prixTotal, setPrixTotal] = useState("0");
  const [planId, setPlanId] = useState("");

  const canManage = permissions.includes(Permission.GERER_PACKS);
  const canActivate = permissions.includes(Permission.ACTIVER_PACKS);

  const filtered = packs.filter((p) => {
    const matchTab = tab === "tous" ? true : tab === "actifs" ? p.isActive : !p.isActive;
    const matchSearch = p.nom.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  function resetForm() {
    setNom("");
    setDescription("");
    setNombreAlevins("");
    setPoidsMoyen("5");
    setPrixTotal("0");
    setPlanId("");
  }

  async function handleCreate() {
    if (!nom.trim()) return;
    if (!planId.trim()) return;
    const nb = parseInt(nombreAlevins, 10);
    if (isNaN(nb) || nb <= 0) return;
    const prix = parseFloat(prixTotal);
    if (isNaN(prix) || prix < 0) return;

    const result = await configService.createPack({
      nom: nom.trim(),
      description: description.trim() || undefined,
      nombreAlevins: nb,
      poidsMoyenInitial: parseFloat(poidsMoyen) || 5,
      prixTotal: prix,
      planId: planId.trim(),
    });
    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      router.refresh();
    }
  }

  async function handleToggleActive(pack: PackData) {
    const result = await configService.updatePack(pack.id, { isActive: !pack.isActive });
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Rechercher un pack..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau Pack</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium">Nom du pack *</label>
                  <Input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Ex: Pack Decouverte 100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description optionnelle"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nombre d'alevins *</label>
                  <Input
                    type="number"
                    min={1}
                    value={nombreAlevins}
                    onChange={(e) => setNombreAlevins(e.target.value)}
                    placeholder="Ex: 100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Poids moyen initial (g)</label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={poidsMoyen}
                    onChange={(e) => setPoidsMoyen(e.target.value)}
                    placeholder="5"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prix total (FCFA)</label>
                  <Input
                    type="number"
                    min={0}
                    value={prixTotal}
                    onChange={(e) => setPrixTotal(e.target.value)}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Plan d&apos;abonnement *</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sélectionner un plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom} ({p.typePlan})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" onClick={resetForm}>Annuler</Button>
                </DialogClose>
                <Button onClick={handleCreate}>Creer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="actifs">Actifs</TabsTrigger>
          <TabsTrigger value="inactifs">Inactifs</TabsTrigger>
          <TabsTrigger value="tous">Tous</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="Aucun pack"
              description={search ? "Aucun pack ne correspond a votre recherche." : "Aucun pack configure pour ce site."}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((pack) => (
                <Card key={pack.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/packs/${pack.id}`}
                            className="font-semibold text-base hover:underline truncate"
                          >
                            {pack.nom}
                          </Link>
                          <Badge variant={pack.isActive ? "en_cours" : "default"}>
                            {pack.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                        {pack.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pack.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            {pack.nombreAlevins.toLocaleString()} alevins
                          </span>
                          <span>{pack.poidsMoyenInitial}g/alevin</span>
                          <span>{pack.prixTotal.toLocaleString()} FCFA</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {pack._count.activations} activation{pack._count.activations !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {pack.produits.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {pack.produits.length} produit{pack.produits.length !== 1 ? "s" : ""} inclus
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {canActivate && pack.isActive && (
                          <Button asChild size="sm" variant="primary">
                            <Link href={`/packs/${pack.id}/activer`}>Activer</Link>
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(pack)}
                          >
                            {pack.isActive ? (
                              <XCircle className="h-4 w-4 mr-1" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            {pack.isActive ? "Desactiver" : "Activer"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
