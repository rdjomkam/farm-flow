"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Users, Pencil, AlertTriangle, Settings, Check, X } from "lucide-react";
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
import { Permission, StatutActivation, UniteStock } from "@/types";

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
  planId: string;
  plan?: { id: string; nom: string } | null;
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
  plans: { id: string; nom: string }[];
  permissions: Permission[];
}

export function PackDetailClient({ pack, produits, configElevages, plans, permissions }: Props) {
  const t = useTranslations("packs");
  const queryClient = useQueryClient();
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
  const [editPlanId, setEditPlanId] = useState(pack.planId);
  const [editConfigElevageId, setEditConfigElevageId] = useState(pack.configElevage?.id ?? "none");
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
      { successMessage: t("detail.bacsConfigures") }
    );
    if (result.ok) {
      setConfigBacsOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
    }
  }

  async function handleEditPack() {
    const result = await configService.updatePack(pack.id, {
      nom: editNom.trim(),
      description: editDescription.trim() || undefined,
      nombreAlevins: parseInt(editNombreAlevins) || 0,
      poidsMoyenInitial: parseFloat(editPoidsMoyenInitial) || 0,
      prixTotal: parseFloat(editPrixTotal) || 0,
      planId: editPlanId,
      configElevageId: editConfigElevageId === "none" ? null : editConfigElevageId,
    });
    if (result.ok) {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
    }
  }

  async function handleConfirmRetirer() {
    if (!retirerProduitId) return;

    const result = await call<unknown>(
      `/api/packs/${pack.id}/produits?produitId=${retirerProduitId}`,
      { method: "DELETE" },
      { successMessage: t("detail.produitRetire") }
    );
    if (result.ok) {
      setRetirerProduitId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
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
            {t("detail.retour")}
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
                    <DialogTitle>{t("detail.modifierTitle")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <Input
                      label={`${t("detail.nomLabel")} *`}
                      value={editNom}
                      onChange={(e) => setEditNom(e.target.value)}
                    />
                    <div>
                      <label className="text-sm font-medium">{t("detail.descriptionLabel")}</label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={t("detail.descriptionPlaceholder")}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <Input
                      label={`${t("detail.nombreAlevinsLabel")} *`}
                      type="number"
                      min={1}
                      value={editNombreAlevins}
                      onChange={(e) => setEditNombreAlevins(e.target.value)}
                    />
                    <Input
                      label={t("detail.poidsMoyenLabel")}
                      type="number"
                      min={0}
                      step={0.1}
                      value={editPoidsMoyenInitial}
                      onChange={(e) => setEditPoidsMoyenInitial(e.target.value)}
                    />
                    <Input
                      label={t("detail.prixTotalLabel")}
                      type="number"
                      min={0}
                      value={editPrixTotal}
                      onChange={(e) => setEditPrixTotal(e.target.value)}
                    />
                    <Select value={editPlanId} onValueChange={setEditPlanId}>
                      <SelectTrigger label={t("detail.planLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={editConfigElevageId} onValueChange={setEditConfigElevageId}>
                      <SelectTrigger label={t("detail.configElevageLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("detail.configElevageAucune")}</SelectItem>
                        {configElevages.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{t("detail.annuler")}</Button>
                    </DialogClose>
                    <Button onClick={handleEditPack} disabled={!editNom.trim()}>
                      {t("detail.enregistrer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Badge variant={pack.isActive ? "en_cours" : "default"}>
              {pack.isActive ? t("detail.badgeActif") : t("detail.badgeInactif")}
            </Badge>
          </div>
        </div>
        {canActivate && pack.isActive && (
          <Button asChild size="sm" className="w-full sm:w-auto mt-3">
            <Link href={`/packs/${pack.id}/activer`}>{t("detail.activerClient")}</Link>
          </Button>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 text-sm mt-4">
          <div>
            <dt className="text-muted-foreground">{t("detail.alevins")}</dt>
            <dd className="font-medium">{formatNumber(pack.nombreAlevins)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail.poidsInitial")}</dt>
            <dd className="font-medium">{pack.poidsMoyenInitial} g/alevin</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail.prixTotal")}</dt>
            <dd className="font-medium">{formatNumber(pack.prixTotal)} FCFA</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail.configElevage")}</dt>
            <dd className="font-medium">{pack.configElevage?.nom ?? t("detail.configElevageNonAssignee")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail.creePar")}</dt>
            <dd className="font-medium">{pack.user.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail.activations")}</dt>
            <dd className="font-medium flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {pack.activations.length}
            </dd>
          </div>
        </dl>

        {/* Plan associé */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">{t("detail.planAbonnement")}</p>
          <span className="text-sm font-medium">
            {pack.plan?.nom ?? pack.planId}
          </span>
        </div>
      </div>

      {/* Configuration bacs */}
      <section className="pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.configBacs")}
          </h2>
          {canManage && (
            <Button size="sm" variant="outline" onClick={openConfigBacs}>
              <Settings className="h-4 w-4 mr-1" />
              {t("detail.configurerBacs")}
            </Button>
          )}
        </div>

        {/* Warning si la somme ne correspond pas */}
        {pack.bacs.length > 0 && !bacsValid && (
          <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 mb-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {t("detail.configBacsWarning", { current: formatNumber(bacsSum), total: formatNumber(pack.nombreAlevins) })}
            </span>
          </div>
        )}

        {pack.bacs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("detail.configBacsEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {pack.bacs.map((bac) => (
              <div key={bac.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{bac.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(bac.nombreAlevins)} alevins
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
              <DialogTitle>{t("detail.configurerBacsTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {localBacs.map((bac, index) => (
                <div key={index} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("detail.bacLabel", { index: index + 1 })}</span>
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
                      label={`${t("detail.bacNomLabel")} *`}
                      value={bac.nom}
                      onChange={(e) => updateLocalBac(index, "nom", e.target.value)}
                      placeholder={t("detail.bacNomPlaceholder")}
                    />
                    <Input
                      label={t("detail.bacVolumeLabel")}
                      type="number"
                      min={0}
                      step={0.1}
                      value={bac.volume}
                      onChange={(e) => updateLocalBac(index, "volume", e.target.value)}
                      placeholder={t("detail.bacVolumePlaceholder")}
                    />
                    <Input
                      label={`${t("detail.bacAlevinsLabel")} *`}
                      type="number"
                      min={1}
                      value={bac.nombreAlevins}
                      onChange={(e) => updateLocalBac(index, "nombreAlevins", e.target.value)}
                    />
                    <Input
                      label={t("detail.bacPoidsLabel")}
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
                {t("detail.ajouterBac")}
              </Button>

              {/* Live validation footer */}
              <div className={[
                "flex items-center justify-between rounded-md p-3 text-sm font-medium",
                localBacsValid
                  ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
              ].join(" ")}>
                <span>
                  {t("detail.totalAlevins", { current: formatNumber(localBacsSum), total: formatNumber(pack.nombreAlevins) })}
                </span>
                {localBacsValid ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </div>

              {!localBacsAllNamed && (
                <p className="text-xs text-destructive">{t("detail.erreurNomsRequis")}</p>
              )}
              {!localBacsNoDuplicates && (
                <p className="text-xs text-destructive">{t("detail.erreurNomsDupliques")}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("detail.annuler")}</Button>
              </DialogClose>
              <Button
                onClick={handleSaveConfigBacs}
                disabled={!localBacsValid || !localBacsAllNamed || !localBacsNoDuplicates}
              >
                {t("detail.enregistrer")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Produits inclus */}
      <section className="pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.produitsInclus")}
          </h2>
          {canManage && produitsDisponibles.length > 0 && (
            <Dialog open={ajoutOpen} onOpenChange={setAjoutOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("detail.ajouterProduit")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("detail.ajouterProduitTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium">{t("detail.produitLabel")} *</label>
                    <Select value={produitId} onValueChange={handleProduitChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t("detail.selectProduitPlaceholder")} />
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
                    <label className="text-sm font-medium">{t("detail.uniteLabel")} *</label>
                    <Select value={unite} onValueChange={setUnite} disabled={!produitId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t("detail.selectUnitePlaceholder")} />
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
                      {unite ? t("detail.uniteQuantiteLabel", { unite }) : t("detail.quantiteLabelSansUnite")} *
                    </label>
                    <Input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={quantite}
                      onChange={(e) => setQuantite(e.target.value)}
                      placeholder={t("placeholderExample", { value: "10" })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" onClick={resetAjoutForm}>{t("detail.annuler")}</Button>
                  </DialogClose>
                  <Button onClick={handleAjoutProduit}>
                    {t("detail.ajouterProduit")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {pack.produits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("detail.aucunProduit")}
          </p>
        ) : (
          <div className="space-y-2">
            {pack.produits.map((pp) => (
              <div key={pp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{pp.produit.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    Quantite : {pp.quantite} {pp.unite ?? pp.produit.unite} — {formatNumber(pp.produit.prixUnitaire)} FCFA/{pp.produit.unite}
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
              <DialogTitle>{t("detail.retirerTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("detail.retirerDescription", { nom: retirerProduitNom })}
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("detail.annuler")}</Button>
              </DialogClose>
              <Button variant="danger" onClick={handleConfirmRetirer}>{t("detail.retirerBtn")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Historique des activations */}
      <section className="pt-6 border-t border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          {t("detail.historiqueActivations")}
        </h2>
        {pack.activations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("detail.aucuneActivation")}
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
                  {t(`statutsActivation.${act.statut as StatutActivation}`)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
