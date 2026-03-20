"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Package, Users, Pencil, AlertTriangle, Settings, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useConfigService } from "@/services";
import { useApi } from "@/hooks/use-api";
import { Permission, SiteModule, StatutActivation, UniteStock } from "@/types";

const MODULE_LABELS: Record<SiteModule, string> = {
  [SiteModule.REPRODUCTION]: "Reproduction",
  [SiteModule.GROSSISSEMENT]: "Grossissement",
  [SiteModule.INTRANTS]: "Intrants",
  [SiteModule.VENTES]: "Ventes",
  [SiteModule.ANALYSE_PILOTAGE]: "Analyse & Pilotage",
  [SiteModule.PACKS_PROVISIONING]: "Packs & Provisioning",
  [SiteModule.CONFIGURATION]: "Configuration",
  [SiteModule.INGENIEUR]: "Ingenieur",
  [SiteModule.NOTES]: "Notes",
};

const statutActivationLabels: Record<StatutActivation, string> = {
  [StatutActivation.ACTIVE]: "Active",
  [StatutActivation.EXPIREE]: "Expiree",
  [StatutActivation.SUSPENDUE]: "Suspendue",
};

const statutActivationVariants: Record<StatutActivation, "en_cours" | "default" | "warning"> = {
  [StatutActivation.ACTIVE]: "en_cours",
  [StatutActivation.EXPIREE]: "default",
  [StatutActivation.SUSPENDUE]: "warning",
};

interface ProduitOption {
  id: string;
  nom: string;
  categorie: string;
  unite: string;
  stockActuel: number;
}

interface PackProduitData {
  id: string;
  quantite: number;
  unite: string | null;
  produit: { id: string; nom: string; categorie: string; unite: string; prixUnitaire: number };
}

interface PackBacData {
  id: string;
  nom: string;
  volume: number | null;
  nombreAlevins: number;
  poidsMoyenInitial: number;
  position: number;
}

interface ActivationData {
  id: string;
  code: string;
  statut: string;
  dateActivation: string;
  dateExpiration: string | null;
  clientSite: { id: string; name: string };
  user: { id: string; name: string };
}

interface PackDetailData {
  id: string;
  nom: string;
  description: string | null;
  nombreAlevins: number;
  poidsMoyenInitial: number;
  prixTotal: number;
  isActive: boolean;
  enabledModules: SiteModule[];
  configElevage: { id: string; nom: string } | null;
  user: { id: string; name: string };
  produits: PackProduitData[];
  bacs: PackBacData[];
  activations: ActivationData[];
}

interface Props {
  pack: PackDetailData;
  produits: ProduitOption[];
  configElevages: { id: string; nom: string }[];
  permissions: Permission[];
}

export function PackDetailClient({ pack, produits, configElevages, permissions }: Props) {
  const router = useRouter();
  const configService = useConfigService();
  const { call } = useApi();
  const [ajoutOpen, setAjoutOpen] = useState(false);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [unite, setUnite] = useState("");

  // Retirer produit confirmation dialog state
  const [retirerProduitId, setRetirerProduitId] = useState<string | null>(null);
  const [retirerProduitNom, setRetirerProduitNom] = useState("");

  // Batch bac config dialog state
  interface LocalBac {
    nom: string;
    volume: string;
    nombreAlevins: string;
    poidsMoyenInitial: string;
  }
  const [configBacsOpen, setConfigBacsOpen] = useState(false);
  const [localBacs, setLocalBacs] = useState<LocalBac[]>([]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editNom, setEditNom] = useState(pack.nom);
  const [editDescription, setEditDescription] = useState(pack.description ?? "");
  const [editNombreAlevins, setEditNombreAlevins] = useState(String(pack.nombreAlevins));
  const [editPoidsMoyenInitial, setEditPoidsMoyenInitial] = useState(String(pack.poidsMoyenInitial));
  const [editPrixTotal, setEditPrixTotal] = useState(String(pack.prixTotal));
  const [editConfigElevageId, setEditConfigElevageId] = useState(pack.configElevage?.id ?? "none");
  const [editEnabledModules, setEditEnabledModules] = useState<SiteModule[]>(pack.enabledModules ?? []);

  function toggleModule(module: SiteModule) {
    setEditEnabledModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
  }

  const canManage = permissions.includes(Permission.GERER_PACKS);
  const canActivate = permissions.includes(Permission.ACTIVER_PACKS);

  function resetAjoutForm() {
    setProduitId("");
    setQuantite("");
    setUnite("");
  }

  function openConfigBacs() {
    // Load current bacs into local state
    setLocalBacs(
      pack.bacs.length > 0
        ? pack.bacs.map((b) => ({
            nom: b.nom,
            volume: b.volume ? String(b.volume) : "",
            nombreAlevins: String(b.nombreAlevins),
            poidsMoyenInitial: String(b.poidsMoyenInitial),
          }))
        : [{ nom: "Bac 1", volume: "", nombreAlevins: String(pack.nombreAlevins), poidsMoyenInitial: String(pack.poidsMoyenInitial) }]
    );
    setConfigBacsOpen(true);
  }

  function addLocalBac() {
    setLocalBacs((prev) => [
      ...prev,
      { nom: `Bac ${prev.length + 1}`, volume: "", nombreAlevins: "", poidsMoyenInitial: String(pack.poidsMoyenInitial) },
    ]);
  }

  function removeLocalBac(index: number) {
    setLocalBacs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLocalBac(index: number, field: keyof LocalBac, value: string) {
    setLocalBacs((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  const localBacsSum = localBacs.reduce((acc, b) => acc + (parseInt(b.nombreAlevins) || 0), 0);
  const localBacsValid = localBacs.length > 0 && localBacsSum === pack.nombreAlevins;
  const localBacsAllNamed = localBacs.every((b) => b.nom.trim() !== "");
  const localBacsNoDuplicates = new Set(localBacs.map((b) => b.nom.trim().toLowerCase())).size === localBacs.length;

  async function handleSaveConfigBacs() {
    if (!localBacsValid || !localBacsAllNamed || !localBacsNoDuplicates) return;

    const result = await call<unknown>(
      `/api/packs/${pack.id}/bacs`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bacs: localBacs.map((b) => ({
            nom: b.nom.trim(),
            volume: b.volume ? parseFloat(b.volume) : null,
            nombreAlevins: parseInt(b.nombreAlevins),
            poidsMoyenInitial: b.poidsMoyenInitial ? parseFloat(b.poidsMoyenInitial) : undefined,
          })),
        }),
      },
      { successMessage: "Bacs configures." }
    );
    if (result.ok) {
      setConfigBacsOpen(false);
      router.refresh();
    }
  }

  async function handleEditPack() {
    const result = await configService.updatePack(pack.id, {
      nom: editNom.trim(),
      description: editDescription.trim() || undefined,
      nombreAlevins: parseInt(editNombreAlevins) || 0,
      poidsMoyenInitial: parseFloat(editPoidsMoyenInitial) || 0,
      prixTotal: parseFloat(editPrixTotal) || 0,
      configElevageId: editConfigElevageId === "none" ? null : editConfigElevageId,
      enabledModules: editEnabledModules,
    });
    if (result.ok) {
      setEditOpen(false);
      router.refresh();
    }
  }

  async function handleAjoutProduit() {
    const qty = parseFloat(quantite);
    const result = await configService.addPackProduit(pack.id, {
      produitId,
      quantite: qty,
      unite: unite ? (unite as import("@/types").UniteStock) : undefined,
    });
    if (result.ok) {
      setAjoutOpen(false);
      resetAjoutForm();
      router.refresh();
    }
  }

  async function handleConfirmRetirer() {
    if (!retirerProduitId) return;

    const result = await call<unknown>(
      `/api/packs/${pack.id}/produits?produitId=${retirerProduitId}`,
      { method: "DELETE" },
      { successMessage: "Produit retire." }
    );
    if (result.ok) {
      setRetirerProduitId(null);
      router.refresh();
    } else {
      setRetirerProduitId(null);
    }
  }

  // Validation somme bacs
  const bacsSum = pack.bacs.reduce((acc, b) => acc + b.nombreAlevins, 0);
  const bacsValid = pack.bacs.length === 0 || bacsSum === pack.nombreAlevins;

  // Produits pas encore dans le pack
  const produitsDisponibles = produits.filter(
    (p) => !pack.produits.some((pp) => pp.produit.id === p.id)
  );
  const selectedProduit = produitsDisponibles.find((p) => p.id === produitId);

  function handleProduitChange(id: string) {
    setProduitId(id);
    const p = produitsDisponibles.find((pr) => pr.id === id);
    if (p) setUnite(p.unite);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/packs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
      </div>

      {/* Pack info */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{pack.nom}</h1>
            {pack.description && (
              <p className="text-sm text-muted-foreground mt-1">{pack.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier le pack</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <Input
                      label="Nom *"
                      value={editNom}
                      onChange={(e) => setEditNom(e.target.value)}
                    />
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description du pack..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <Input
                      label="Nombre d'alevins *"
                      type="number"
                      min={1}
                      value={editNombreAlevins}
                      onChange={(e) => setEditNombreAlevins(e.target.value)}
                    />
                    <Input
                      label="Poids moyen initial (g)"
                      type="number"
                      min={0}
                      step={0.1}
                      value={editPoidsMoyenInitial}
                      onChange={(e) => setEditPoidsMoyenInitial(e.target.value)}
                    />
                    <Input
                      label="Prix total (FCFA)"
                      type="number"
                      min={0}
                      value={editPrixTotal}
                      onChange={(e) => setEditPrixTotal(e.target.value)}
                    />
                    <Select value={editConfigElevageId} onValueChange={setEditConfigElevageId}>
                      <SelectTrigger label="Config elevage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {configElevages.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div>
                      <label className="text-sm font-medium">Modules activés</label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Laisser vide = tous les modules accessibles
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.values(SiteModule).map((mod) => {
                          const checked = editEnabledModules.includes(mod);
                          return (
                            <button
                              key={mod}
                              type="button"
                              onClick={() => toggleModule(mod)}
                              className={[
                                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                checked
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border hover:border-primary/50",
                              ].join(" ")}
                            >
                              {MODULE_LABELS[mod]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button onClick={handleEditPack} disabled={!editNom.trim()}>
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Badge variant={pack.isActive ? "en_cours" : "default"}>
              {pack.isActive ? "Actif" : "Inactif"}
            </Badge>
          </div>
        </div>
        {canActivate && pack.isActive && (
          <Button asChild size="sm" className="w-full sm:w-auto mt-3">
            <Link href={`/packs/${pack.id}/activer`}>Activer pour un client</Link>
          </Button>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 text-sm mt-4">
          <div>
            <dt className="text-muted-foreground">Alevins</dt>
            <dd className="font-medium">{pack.nombreAlevins.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Poids initial</dt>
            <dd className="font-medium">{pack.poidsMoyenInitial} g/alevin</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prix total</dt>
            <dd className="font-medium">{pack.prixTotal.toLocaleString()} FCFA</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Config elevage</dt>
            <dd className="font-medium">{pack.configElevage?.nom ?? "Non assignee"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cree par</dt>
            <dd className="font-medium">{pack.user.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Activations</dt>
            <dd className="font-medium flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {pack.activations.length}
            </dd>
          </div>
        </dl>

        {/* Modules activés */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">Modules activés</p>
          {(!pack.enabledModules || pack.enabledModules.length === 0) ? (
            <span className="text-sm text-muted-foreground italic">Tous les modules</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pack.enabledModules.map((mod) => (
                <Badge key={mod} variant="default" className="text-xs">
                  {MODULE_LABELS[mod as SiteModule] ?? mod}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuration bacs */}
      <section className="pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Configuration bacs
          </h2>
          {canManage && (
            <Button size="sm" variant="outline" onClick={openConfigBacs}>
              <Settings className="h-4 w-4 mr-1" />
              Configurer les bacs
            </Button>
          )}
        </div>

        {/* Warning si la somme ne correspond pas */}
        {pack.bacs.length > 0 && !bacsValid && (
          <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 mb-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              La somme des alevins ({bacsSum.toLocaleString()}) ne correspond pas au total du pack ({pack.nombreAlevins.toLocaleString()}).
              Corrigez la configuration avant d&apos;activer ce pack.
            </span>
          </div>
        )}

        {pack.bacs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune configuration de bacs — 1 bac par defaut sera cree a l&apos;activation.
          </p>
        ) : (
          <div className="space-y-2">
            {pack.bacs.map((bac) => (
              <div key={bac.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{bac.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {bac.nombreAlevins.toLocaleString()} alevins
                    {bac.poidsMoyenInitial ? ` — ${bac.poidsMoyenInitial} g/alevin` : ""}
                    {bac.volume ? ` — ${bac.volume} m³` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Batch config dialog */}
        <Dialog open={configBacsOpen} onOpenChange={setConfigBacsOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurer les bacs</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {localBacs.map((bac, index) => (
                <div key={index} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Bac {index + 1}</span>
                    {localBacs.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => removeLocalBac(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Nom *"
                      value={bac.nom}
                      onChange={(e) => updateLocalBac(index, "nom", e.target.value)}
                      placeholder="Ex: Bac A"
                    />
                    <Input
                      label="Volume (m³)"
                      type="number"
                      min={0}
                      step={0.1}
                      value={bac.volume}
                      onChange={(e) => updateLocalBac(index, "volume", e.target.value)}
                      placeholder="Optionnel"
                    />
                    <Input
                      label="Alevins *"
                      type="number"
                      min={1}
                      value={bac.nombreAlevins}
                      onChange={(e) => updateLocalBac(index, "nombreAlevins", e.target.value)}
                    />
                    <Input
                      label="Poids (g)"
                      type="number"
                      min={0}
                      step={0.1}
                      value={bac.poidsMoyenInitial}
                      onChange={(e) => updateLocalBac(index, "poidsMoyenInitial", e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <Button size="sm" variant="outline" className="w-full" onClick={addLocalBac}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un bac
              </Button>

              {/* Live validation footer */}
              <div className={[
                "flex items-center justify-between rounded-md p-3 text-sm font-medium",
                localBacsValid
                  ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
              ].join(" ")}>
                <span>
                  Total : {localBacsSum.toLocaleString()} / {pack.nombreAlevins.toLocaleString()} alevins
                </span>
                {localBacsValid ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </div>

              {!localBacsAllNamed && (
                <p className="text-xs text-destructive">Tous les bacs doivent avoir un nom.</p>
              )}
              {!localBacsNoDuplicates && (
                <p className="text-xs text-destructive">Les noms de bacs doivent etre uniques.</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleSaveConfigBacs}
                disabled={!localBacsValid || !localBacsAllNamed || !localBacsNoDuplicates}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Produits inclus */}
      <section className="pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Produits inclus
          </h2>
          {canManage && produitsDisponibles.length > 0 && (
            <Dialog open={ajoutOpen} onOpenChange={setAjoutOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un produit au pack</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium">Produit *</label>
                    <Select value={produitId} onValueChange={handleProduitChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selectionnez un produit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produitsDisponibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nom} ({p.unite})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Unite *</label>
                    <Select value={unite} onValueChange={setUnite} disabled={!produitId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selectionnez une unite..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(UniteStock).map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Quantite{unite ? ` (${unite})` : ""} *
                    </label>
                    <Input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={quantite}
                      onChange={(e) => setQuantite(e.target.value)}
                      placeholder="Ex: 10"
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" onClick={resetAjoutForm}>Annuler</Button>
                  </DialogClose>
                  <Button onClick={handleAjoutProduit}>
                    Ajouter
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {pack.produits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun produit dans ce pack.
          </p>
        ) : (
          <div className="space-y-2">
            {pack.produits.map((pp) => (
              <div key={pp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{pp.produit.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    Quantite : {pp.quantite} {pp.unite ?? pp.produit.unite} — {pp.produit.prixUnitaire.toLocaleString()} FCFA/{pp.produit.unite}
                  </p>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { setRetirerProduitId(pp.produit.id); setRetirerProduitNom(pp.produit.nom); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Confirmation dialog for removing a product */}
        <Dialog open={retirerProduitId !== null} onOpenChange={(open) => { if (!open) setRetirerProduitId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Retirer ce produit ?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              &quot;{retirerProduitNom}&quot; sera retire du pack.
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button variant="danger" onClick={handleConfirmRetirer}>Retirer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Historique des activations */}
      <section className="pt-6 border-t border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Historique des activations
        </h2>
        {pack.activations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune activation pour ce pack.
          </p>
        ) : (
          <div className="space-y-2">
            {pack.activations.map((act) => (
              <div key={act.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-mono text-sm font-medium">{act.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {act.clientSite.name} — {new Date(act.dateActivation).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge variant={statutActivationVariants[act.statut as StatutActivation]}>
                  {statutActivationLabels[act.statut as StatutActivation]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
