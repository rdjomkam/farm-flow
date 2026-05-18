"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations, useLocale } from "next-intl";
import { formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  Users,
  Waves,
  Calendar,
  FileText,
  Pencil,
  Truck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { StatutFacture, StatutVente, Permission } from "@/types";
import type { UpdateVenteDTO, ClotureVenteDTO } from "@/types";
import { useVenteService } from "@/services";

const statutVariants: Record<string, "default" | "info" | "warning" | "terminee" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

const venteStatutVariants: Record<string, "warning" | "terminee"> = {
  [StatutVente.EN_PREPARATION]: "warning",
  [StatutVente.LIVREE]: "terminee",
};

interface VenteData {
  id: string;
  numero: string;
  quantitePoissons: number;
  poidsTotalKg: number;
  prixUnitaireKg: number;
  montantTotal: number;
  notes: string | null;
  createdAt: string;
  dateCommande: string;
  statut: string;
  dateLivraison: string | null;
  poidsLivreKg: number | null;
  quantiteLivree: number | null;
  client: {
    id: string;
    nom: string;
    telephone: string | null;
    email: string | null;
    adresse: string | null;
  };
  vague: { id: string; code: string; statut: string };
  user: { id: string; name: string };
  facture: {
    id: string;
    numero: string;
    statut: string;
    montantPaye: number;
    montantTotal: number;
    paiements: { id: string; montant: number; mode: string; date: string }[];
  } | null;
}

interface ClientOption {
  id: string;
  nom: string;
}

interface VagueOption {
  id: string;
  code: string;
  poissonsDisponibles: number;
}

interface Props {
  vente: VenteData;
  permissions: Permission[];
  clients?: ClientOption[];
  vagues?: VagueOption[];
}

export function VenteDetailClient({ vente, permissions, clients = [], vagues = [] }: Props) {
  const t = useTranslations("ventes");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const venteService = useVenteService();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editClientId, setEditClientId] = useState(vente.client.id);
  const [editVagueId, setEditVagueId] = useState(vente.vague.id);
  const [editPoidsTotalKg, setEditPoidsTotalKg] = useState(String(vente.poidsTotalKg));
  const [editPrixUnitaireKg, setEditPrixUnitaireKg] = useState(String(vente.prixUnitaireKg));
  const [editNotes, setEditNotes] = useState(vente.notes ?? "");
  const [editMotif, setEditMotif] = useState("");

  // Closure dialog state
  const [clotureOpen, setClotureOpen] = useState(false);
  const [clotureLoading, setClotureLoading] = useState(false);
  const [cloturePoidsLivre, setCloturePoidsLivre] = useState("");
  const [clotureDateLivraison, setClotureDateLivraison] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const statutLabel = (s: string) =>
    t(`factures.statuts.${s}` as Parameters<typeof t>[0]) || s;

  async function handleCreateFacture() {
    const result = await venteService.createFacture(vente.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
    }
  }

  function resetEditForm() {
    setEditClientId(vente.client.id);
    setEditVagueId(vente.vague.id);
    setEditPoidsTotalKg(String(vente.poidsTotalKg));
    setEditPrixUnitaireKg(String(vente.prixUnitaireKg));
    setEditNotes(vente.notes ?? "");
    setEditMotif("");
  }

  async function handleSaveEdit() {
    setEditLoading(true);
    try {
      const dto: UpdateVenteDTO = { motif: editMotif.trim() };

      if (editClientId !== vente.client.id) dto.clientId = editClientId;
      if (editVagueId !== vente.vague.id) dto.vagueId = editVagueId;
      const poids = parseFloat(editPoidsTotalKg);
      if (!isNaN(poids) && poids !== vente.poidsTotalKg) dto.poidsTotalKg = poids;
      const prix = parseFloat(editPrixUnitaireKg);
      if (!isNaN(prix) && prix !== vente.prixUnitaireKg) dto.prixUnitaireKg = prix;
      if (editNotes !== (vente.notes ?? "")) dto.notes = editNotes || undefined;

      const result = await venteService.updateVente(vente.id, dto);
      if (result.ok) {
        setEditOpen(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
        router.refresh();
      }
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCloture() {
    setClotureLoading(true);
    try {
      const dto: ClotureVenteDTO = {
        poidsLivreKg: parseFloat(cloturePoidsLivre),
        ...(clotureDateLivraison && { dateLivraison: clotureDateLivraison }),
      };
      const result = await venteService.cloturerVente(vente.id, dto);
      if (result.ok) {
        setClotureOpen(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
        router.refresh();
      }
    } finally {
      setClotureLoading(false);
    }
  }

  const cloturePoidsNum = parseFloat(cloturePoidsLivre) || 0;
  const cloturePertePoids = vente.poidsTotalKg - cloturePoidsNum;
  const cloturePoidsMoyenG = vente.quantitePoissons > 0
    ? (vente.poidsTotalKg * 1000) / vente.quantitePoissons
    : 0;
  const clotureQuantiteLivree = cloturePoidsMoyenG > 0 && cloturePoidsNum > 0
    ? Math.min(vente.quantitePoissons, Math.max(1, Math.round((cloturePoidsNum * 1000) / cloturePoidsMoyenG)))
    : 0;
  const cloturePertePoissons = vente.quantitePoissons - clotureQuantiteLivree;
  const clotureNouveauMontant = cloturePoidsNum * vente.prixUnitaireKg;
  const clotureValid = cloturePoidsNum > 0 && cloturePoidsNum <= vente.poidsTotalKg;

  const canEdit = permissions.includes(Permission.VENTES_MODIFIER);
  const editMontantPreview = (() => {
    const p = parseFloat(editPoidsTotalKg);
    const px = parseFloat(editPrixUnitaireKg);
    return !isNaN(p) && !isNaN(px) ? p * px : 0;
  })();

  const vagueChanged = editVagueId !== vente.vague.id;
  const motifValid = editMotif.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/ventes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("ventes.detail.back")}
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{vente.numero}</h2>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Dialog open={editOpen} onOpenChange={(open) => {
                  setEditOpen(open);
                  if (open) resetEditForm();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-4 w-4 mr-1" />
                      {t("ventes.detail.modifier")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t("ventes.detail.modifierTitle")}</DialogTitle>
                      <DialogDescription>
                        {t("ventes.detail.modifierDescription")}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-2">
                      {/* Client */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">{t("ventes.form.client")}</label>
                        <Select value={editClientId} onValueChange={setEditClientId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Vague */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">{t("ventes.form.vague")}</label>
                        <Select value={editVagueId} onValueChange={setEditVagueId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {vagues.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.code} ({v.poissonsDisponibles} poissons)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {vagueChanged && (
                          <p className="text-xs text-orange-600">
                            {t("ventes.detail.vagueChangeWarning")}
                          </p>
                        )}
                      </div>

                      {/* Poids total */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">{t("ventes.form.poidsTotalKg")}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={editPoidsTotalKg}
                          onChange={(e) => setEditPoidsTotalKg(e.target.value)}
                        />
                      </div>

                      {/* Prix unitaire */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">{t("ventes.form.prixUnitaireKg")}</label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={editPrixUnitaireKg}
                          onChange={(e) => setEditPrixUnitaireKg(e.target.value)}
                        />
                      </div>

                      {/* Montant preview */}
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-lg font-bold">
                          {formatNumber(editMontantPreview)} FCFA
                        </p>
                        <p className="text-xs text-muted-foreground">{t("ventes.detail.montantTotal")}</p>
                      </div>

                      {/* Notes */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">{t("ventes.form.notes")}</label>
                        <Textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder={t("ventes.form.notesPlaceholder")}
                          rows={2}
                        />
                      </div>

                      {/* Motif (obligatoire) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">
                          {t("ventes.detail.motifLabel")} <span className="text-destructive">*</span>
                        </label>
                        <Textarea
                          value={editMotif}
                          onChange={(e) => setEditMotif(e.target.value)}
                          placeholder={t("ventes.detail.motifPlaceholder")}
                          rows={2}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">{t("paiements.cancel")}</Button>
                      </DialogClose>
                      <Button
                        onClick={handleSaveEdit}
                        disabled={editLoading || !motifValid}
                        className="min-h-[44px]"
                      >
                        {editLoading ? "..." : t("ventes.detail.enregistrerModification")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Badge variant={venteStatutVariants[vente.statut] ?? "warning"}>
                {t(`ventes.detail.statut${vente.statut}` as Parameters<typeof t>[0])}
              </Badge>
              {vente.facture ? (
                <Badge variant={statutVariants[vente.facture.statut] ?? "default"}>
                  {statutLabel(vente.facture.statut)}
                </Badge>
              ) : (
                <Badge variant="default">{t("ventes.sansFature")}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>{vente.client.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Waves className="h-4 w-4 shrink-0" />
              <span>{vente.vague.code}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {t("ventes.detail.dateCommande")} : {new Date(vente.dateCommande).toLocaleDateString(locale)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("ventes.detail.detailVente")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventes.detail.poissons")}</span>
              <span>{vente.quantitePoissons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventes.detail.poidsTotalKg")}</span>
              <span>{vente.poidsTotalKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventes.detail.prixKg")}</span>
              <span>{formatNumber(vente.prixUnitaireKg)} F</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total */}
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-2xl font-bold">
          {formatNumber(vente.montantTotal)} FCFA
        </p>
        <p className="text-xs text-muted-foreground">{t("ventes.detail.montantTotal")}</p>
      </div>

      {/* Delivery section */}
      {vente.statut === StatutVente.LIVREE ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t("ventes.detail.dateLivraison")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ventes.detail.dateLivraison")}</span>
                <span>{vente.dateLivraison ? new Date(vente.dateLivraison).toLocaleDateString(locale) : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ventes.detail.poidsLivreKg")}</span>
                <span>{vente.poidsLivreKg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ventes.detail.quantiteLivree")}</span>
                <span>{vente.quantiteLivree}</span>
              </div>
              {vente.poidsLivreKg != null && vente.poidsLivreKg < vente.poidsTotalKg && (
                <div className="flex justify-between text-orange-600">
                  <span>{t("ventes.detail.pertePoids")}</span>
                  <span>{(vente.poidsTotalKg - vente.poidsLivreKg).toFixed(1)} kg</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : canEdit ? (
        <Dialog open={clotureOpen} onOpenChange={(open) => {
          setClotureOpen(open);
          if (open) {
            setCloturePoidsLivre("");
            setClotureDateLivraison(new Date().toISOString().slice(0, 10));
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full min-h-[48px]">
              <Truck className="h-4 w-4 mr-2" />
              {t("ventes.detail.cloturerLivraison")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("ventes.detail.cloturerTitle")}</DialogTitle>
              <DialogDescription>
                {t("ventes.detail.cloturerDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <Input
                label={t("ventes.detail.poidsLivreKg")}
                type="number"
                step="0.1"
                min="0.1"
                max={vente.poidsTotalKg}
                placeholder={t("ventes.detail.poidsLivrePlaceholder")}
                value={cloturePoidsLivre}
                onChange={(e) => setCloturePoidsLivre(e.target.value)}
              />

              <Input
                label={t("ventes.detail.dateLivraison")}
                type="date"
                value={clotureDateLivraison}
                onChange={(e) => setClotureDateLivraison(e.target.value)}
              />

              {cloturePoidsNum > 0 && cloturePoidsNum <= vente.poidsTotalKg && (
                <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("ventes.detail.nouveauMontant")}</span>
                    <span className="font-bold">{formatNumber(clotureNouveauMontant)} FCFA</span>
                  </div>
                  {cloturePertePoids > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>{t("ventes.detail.pertePoids")}</span>
                        <span>{cloturePertePoids.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>{t("ventes.detail.pertePoissons")}</span>
                        <span>~{cloturePertePoissons}</span>
                      </div>
                      <div className="flex items-start gap-2 rounded-md bg-orange-50 dark:bg-orange-950/20 p-2 text-xs text-orange-700 dark:text-orange-400">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{t("ventes.detail.avarieWarning")}</span>
                      </div>
                    </>
                  )}
                  {cloturePertePoids === 0 && (
                    <p className="text-xs text-emerald-600">{t("ventes.detail.livraisonComplete")}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("paiements.cancel")}</Button>
              </DialogClose>
              <Button
                onClick={handleCloture}
                disabled={clotureLoading || !clotureValid}
                className="min-h-[44px]"
              >
                {clotureLoading ? "..." : t("ventes.detail.confirmerCloture")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Facture section */}
      {vente.facture ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.detail.factureAssociee")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Link
              href={`/factures/${vente.facture.id}`}
              className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <div>
                <p className="font-semibold text-sm">{vente.facture.numero}</p>
                <p className="text-xs text-muted-foreground">
                  {t("ventes.detail.payeLabel", {
                    paye: formatNumber(vente.facture.montantPaye),
                    total: formatNumber(vente.facture.montantTotal),
                  })}
                </p>
              </div>
              <Badge variant={statutVariants[vente.facture.statut] ?? "default"}>
                {statutLabel(vente.facture.statut)}
              </Badge>
            </Link>
          </CardContent>
        </Card>
      ) : permissions.includes(Permission.VENTES_CREER) ? (
        <Button onClick={handleCreateFacture} className="w-full min-h-[48px]">
          <FileText className="h-4 w-4 mr-2" /> {t("ventes.detail.genererFacture")}
        </Button>
      ) : null}

      {/* Client info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("ventes.detail.client")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{vente.client.nom}</p>
            {vente.client.telephone && (
              <p className="text-muted-foreground">{vente.client.telephone}</p>
            )}
            {vente.client.email && (
              <p className="text-muted-foreground">{vente.client.email}</p>
            )}
            {vente.client.adresse && (
              <p className="text-muted-foreground">{vente.client.adresse}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {vente.notes && (
        <p className="text-sm text-muted-foreground italic">{vente.notes}</p>
      )}

      <p className="text-xs text-muted-foreground text-center mb-2">
        {t("ventes.detail.creePar", { name: vente.user.name })}
      </p>
    </div>
  );
}
