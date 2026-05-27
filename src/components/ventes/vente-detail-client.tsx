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
  Lock,
  Fish,
  Info,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
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
import { effectiveMontantBrut, totalDepensesVente, montantNetVente } from "@/lib/ventes-helpers";
import { DepenseVenteDialog } from "@/components/ventes/depense-vente-dialog";
import { DeleteDepenseConfirmDialog } from "@/components/ventes/delete-depense-confirm-dialog";

const statutVariants: Record<string, "default" | "info" | "warning" | "terminee" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

const venteStatutVariants: Record<string, "warning" | "terminee" | "default"> = {
  [StatutVente.EN_PREPARATION]: "warning",
  [StatutVente.LIVREE]: "terminee",
  [StatutVente.CLOTUREE]: "default",
};

interface LigneVenteDisplay {
  id: string;
  vagueId: string;
  bacId: string;
  poidsTotalKg: number;
  poidsMoyenG: number;
  nombrePoissons: number;
  vague?: { id: string; code: string } | null;
  bac?: { id: string; nom: string } | null;
}

interface ReleveVenteDisplay {
  id: string;
  typeReleve: string;
  date: string;
  nombreVendus: number | null;
  nombreMorts: number | null;
  causeMortalite: string | null;
  notes: string | null;
  bac?: { id: string; nom: string } | null;
  vague?: { id: string; code: string } | null;
}

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
  poidsCommandeKg: number | null;
  quantiteCommandee: number | null;
  poidsLivreKg: number | null;
  quantiteLivree: number | null;
  client: {
    id: string;
    nom: string;
    telephone: string | null;
    email: string | null;
    adresse: string | null;
  };
  vague: { id: string; code: string; statut: string } | null;
  user: { id: string; name: string };
  facture: {
    id: string;
    numero: string;
    statut: string;
    montantPaye: number;
    montantTotal: number;
    paiements: { id: string; montant: number; mode: string; date: string }[];
  } | null;
  lignes?: LigneVenteDisplay[];
  releves?: ReleveVenteDisplay[];
  depenses?: DepenseVenteDisplay[];
}

interface DepenseVenteDisplay {
  id: string;
  description: string;
  categorieDepense: string;
  date: string;
  montantTotal: number;
  statut: string;
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

const CATEGORIE_DEPENSE_LABELS: Record<string, string> = {
  ALIMENT: "Alimentation",
  INTRANT: "Intrants",
  EQUIPEMENT: "Equipements",
  ELECTRICITE: "Electricite",
  EAU: "Eau",
  LOYER: "Loyer",
  SALAIRE: "Salaire",
  TRANSPORT: "Transport",
  VETERINAIRE: "Veterinaire",
  REPARATION: "Reparation",
  INVESTISSEMENT: "Investissement",
  AUTRE: "Autre",
};

export function VenteDetailClient({ vente, permissions, clients = [], vagues = [] }: Props) {
  const t = useTranslations("ventes");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const venteService = useVenteService();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editClientId, setEditClientId] = useState(vente.client.id);
  const [editPrixUnitaireKg, setEditPrixUnitaireKg] = useState(String(vente.prixUnitaireKg));
  const [editDateCommande, setEditDateCommande] = useState(
    vente.dateCommande ? new Date(vente.dateCommande).toISOString().slice(0, 10) : ""
  );
  const [editNotes, setEditNotes] = useState(vente.notes ?? "");
  const [editMotif, setEditMotif] = useState("");

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      router.refresh();
    }
  }

  function resetEditForm() {
    setEditClientId(vente.client.id);
    setEditPrixUnitaireKg(String(vente.prixUnitaireKg));
    setEditDateCommande(
      vente.dateCommande ? new Date(vente.dateCommande).toISOString().slice(0, 10) : ""
    );
    setEditNotes(vente.notes ?? "");
    setEditMotif("");
  }

  async function handleSaveEdit() {
    setEditLoading(true);
    try {
      const dto: UpdateVenteDTO = { motif: editMotif.trim() };

      if (editClientId !== vente.client.id) dto.clientId = editClientId;
      const prix = parseFloat(editPrixUnitaireKg);
      if (!isNaN(prix) && prix !== vente.prixUnitaireKg) dto.prixUnitaireKg = prix;
      const origDate = vente.dateCommande
        ? new Date(vente.dateCommande).toISOString().slice(0, 10)
        : "";
      if (editDateCommande !== origDate) dto.dateCommande = editDateCommande;
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

  async function handleCloturerDefinitivement() {
    const result = await venteService.cloturerDefinitivement(vente.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      const result = await venteService.deleteVente(vente.id);
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
        router.push("/ventes");
      }
    } finally {
      setDeleteLoading(false);
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

  const canEdit = permissions.includes(Permission.VENTES_MODIFIER) && vente.statut !== StatutVente.CLOTUREE;
  const motifValid = editMotif.trim().length > 0;

  // Derive vague display label
  const lignes = vente.lignes ?? [];
  const vagueCodes = [...new Set(
    lignes.map((l) => l.vague?.code).filter((c): c is string => c != null)
  )];
  const vagueLabel = vente.vague?.code
    ? vente.vague.code
    : vagueCodes.length > 0
    ? vagueCodes.join(", ")
    : t("ventes.detail.multipleBatches");

  // Group lignes by vague for the sources section
  const lignesParVague: Record<string, { vagueCode: string; lignes: LigneVenteDisplay[] }> = {};
  for (const ligne of lignes) {
    const code = ligne.vague?.code ?? ligne.vagueId;
    if (!lignesParVague[code]) {
      lignesParVague[code] = { vagueCode: code, lignes: [] };
    }
    lignesParVague[code].lignes.push(ligne);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Back + context menu row */}
      <div className="flex items-center justify-between">
        <Link
          href="/ventes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("ventes.detail.back")}
        </Link>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Edit */}
              <DropdownMenuItem
                onSelect={() => { resetEditForm(); setEditOpen(true); }}
              >
                <Pencil className="h-4 w-4" />
                {t("ventes.detail.modifier")}
              </DropdownMenuItem>

              {/* Close delivery (EN_PREPARATION only) */}
              {vente.statut === StatutVente.EN_PREPARATION && (
                <DropdownMenuItem
                  onSelect={() => {
                    setCloturePoidsLivre("");
                    setClotureDateLivraison(new Date().toISOString().slice(0, 10));
                    setClotureOpen(true);
                  }}
                >
                  <Truck className="h-4 w-4" />
                  {t("ventes.detail.cloturerLivraison")}
                </DropdownMenuItem>
              )}

              {/* Close definitively (LIVREE only) */}
              {vente.statut === StatutVente.LIVREE && (
                <DropdownMenuItem onSelect={handleCloturerDefinitivement}>
                  <Lock className="h-4 w-4" />
                  {t("ventes.detail.cloturerDefinitivement")}
                </DropdownMenuItem>
              )}

              {/* Generate invoice (LIVREE + no facture) */}
              {!vente.facture && vente.statut === StatutVente.LIVREE && permissions.includes(Permission.VENTES_CREER) && (
                <DropdownMenuItem onSelect={handleCreateFacture}>
                  <FileText className="h-4 w-4" />
                  {t("ventes.detail.genererFacture")}
                </DropdownMenuItem>
              )}

              {/* Delete */}
              {vente.statut !== StatutVente.CLOTUREE && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("ventes.detail.deleteConfirm")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Delete dialog (controlled, no trigger) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("ventes.detail.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("ventes.detail.deleteDescription", { numero: vente.numero })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-destructive/10 p-3 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t("ventes.detail.deleteWarning")}</span>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("paiements.cancel")}</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="min-h-[44px]"
            >
              {deleteLoading ? "..." : t("ventes.detail.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog (controlled, no trigger) */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (open) resetEditForm();
      }}>
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

            {/* Sources (read-only note) */}
            {lignes.length > 0 && (
              <div className="rounded-lg border border-dashed border-border/50 p-3 flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {t("ventes.detail.sourcesNote")}
                </p>
              </div>
            )}

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

            {/* Date de commande */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("ventes.detail.dateCommande")}</label>
              <Input
                type="date"
                value={editDateCommande}
                onChange={(e) => setEditDateCommande(e.target.value)}
              />
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

      {/* Cloture dialog (controlled, no trigger) */}
      <Dialog open={clotureOpen} onOpenChange={(open) => {
        setClotureOpen(open);
        if (open) {
          setCloturePoidsLivre("");
          setClotureDateLivraison(new Date().toISOString().slice(0, 10));
        }
      }}>
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

      {/* Title + badges */}
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">{vente.numero}</h2>
        <div className="flex items-center gap-2">
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

      {/* Header info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>{vente.client.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Waves className="h-4 w-4 shrink-0" />
              <span>{vagueLabel}</span>
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

      {/* Sources section — lignes par vague/bac */}
      {lignes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fish className="h-4 w-4" />
              {t("ventes.detail.sources")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex flex-col gap-3">
            {Object.values(lignesParVague).map(({ vagueCode, lignes: groupLignes }) => (
              <div key={vagueCode} className="flex flex-col gap-2">
                {/* Vague header */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {vagueCode}
                </p>
                {/* Per-bac cards */}
                {groupLignes.map((ligne) => (
                  <div
                    key={ligne.id}
                    className="rounded-lg bg-muted/30 p-3 flex flex-col gap-1"
                  >
                    <p className="font-medium text-sm">
                      {ligne.bac?.nom ?? t("ventes.detail.perBac")}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground font-medium">{ligne.poidsTotalKg} kg</span>
                        <span>{t("ventes.detail.poidsTotalKg")}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground font-medium">{ligne.poidsMoyenG} g</span>
                        <span>{t("ventes.form.avgWeight")}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground font-medium">{ligne.nombrePoissons}</span>
                        <span>{t("ventes.detail.poissons")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Total */}
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-2xl font-bold">
          {formatNumber(vente.montantTotal)} FCFA
        </p>
        <p className="text-xs text-muted-foreground">
          {vente.statut === StatutVente.EN_PREPARATION
            ? t("ventes.detail.montantEstime")
            : t("ventes.detail.montantFinal")}
        </p>
      </div>

      {/* Dépenses associées à la vente (DV.4) */}
      {(vente.statut === StatutVente.LIVREE || vente.statut === StatutVente.CLOTUREE || (vente.depenses ?? []).length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{t("depenses.title")}</span>
              {(() => {
                const canAddDepense =
                  (vente.statut !== StatutVente.CLOTUREE ||
                    permissions.includes(Permission.DEPENSES_VENTE_RETRO)) &&
                  permissions.includes(Permission.DEPENSES_CREER);
                return (
                  <>
                    {canAddDepense && <DepenseVenteDialog venteId={vente.id} />}
                    {vente.statut === StatutVente.CLOTUREE && !canAddDepense && (
                      <p className="text-xs text-muted-foreground italic font-normal">
                        {t("depenses.closedSaleInfo")}
                      </p>
                    )}
                  </>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {(vente.depenses ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("depenses.empty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(vente.depenses ?? []).map((d) => {
                  const canEdit =
                    (vente.statut !== StatutVente.CLOTUREE ||
                      permissions.includes(Permission.DEPENSES_VENTE_RETRO)) &&
                    permissions.includes(Permission.DEPENSES_CREER);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{d.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {CATEGORIE_DEPENSE_LABELS[d.categorieDepense] ?? d.categorieDepense}
                          {" · "}
                          {new Date(d.date).toLocaleDateString(locale)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2 flex items-center gap-2">
                        <div>
                          <div className="font-semibold text-sm text-destructive">
                            -{formatNumber(d.montantTotal)} F
                          </div>
                          <div className="text-xs text-muted-foreground">{d.statut}</div>
                        </div>
                        {canEdit && (
                          <>
                            <DepenseVenteDialog
                              venteId={vente.id}
                              existingDepense={d}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label={t("depenses.editAria")}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <DeleteDepenseConfirmDialog
                              depenseId={d.id}
                              venteId={vente.id}
                              description={d.description}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Récap brut / dépenses / net */}
            {(vente.depenses ?? []).length > 0 && (() => {
              const depenses = vente.depenses ?? [];
              const brut = effectiveMontantBrut(vente);
              const totalDep = totalDepensesVente(depenses);
              const net = montantNetVente(vente, depenses);
              return (
                <div className="mt-4 rounded-md bg-muted/30 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("depenses.recap.brut")}</span>
                    <span className="font-medium">{formatNumber(brut)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>{t("depenses.recap.depenses")}</span>
                    <span className="font-medium">- {formatNumber(totalDep)} FCFA</span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5">
                    <span className="font-semibold">{t("depenses.recap.net")}</span>
                    <span className="font-bold text-success">{formatNumber(net)} FCFA</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Delivery info (read-only, shown when LIVREE or CLOTUREE) */}
      {(vente.statut === StatutVente.LIVREE || vente.statut === StatutVente.CLOTUREE) && (
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
              {vente.poidsCommandeKg != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("ventes.detail.poidsCommandeKg")}</span>
                  <span>{vente.poidsCommandeKg} kg</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ventes.detail.poidsLivreKg")}</span>
                <span>{vente.poidsTotalKg} kg</span>
              </div>
              {vente.poidsCommandeKg != null && vente.poidsCommandeKg > vente.poidsTotalKg && (
                <div className="flex justify-between text-orange-600">
                  <span>{t("ventes.detail.pertePoids")}</span>
                  <span>{(vente.poidsCommandeKg - vente.poidsTotalKg).toFixed(1)} kg</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Releves linked to this vente (VENTE + AVARIE) */}
      {(vente.releves ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fish className="h-4 w-4" />
              {t("ventes.detail.relevesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex flex-col gap-2">
            {(vente.releves ?? []).map((r) => {
              const isAvarie = r.typeReleve === "MORTALITE" && r.causeMortalite === "AVARIE";
              const isVente = r.typeReleve === "VENTE";
              return (
                <div
                  key={r.id}
                  className={`rounded-lg p-3 flex items-center justify-between text-sm ${
                    isAvarie ? "bg-orange-50 dark:bg-orange-950/20" : "bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      {isVente && (
                        <Badge variant="terminee" className="text-[10px] px-1.5 py-0">
                          {t("ventes.detail.releveVente")}
                        </Badge>
                      )}
                      {isAvarie && (
                        <Badge variant="annulee" className="text-[10px] px-1.5 py-0">
                          {t("ventes.detail.releveAvarie")}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {r.bac?.nom ?? "-"} • {r.vague?.code ?? "-"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.date).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <div className="text-right font-medium">
                    {isVente && r.nombreVendus != null && (
                      <span>{r.nombreVendus} {t("ventes.detail.poissonsVendus")}</span>
                    )}
                    {isAvarie && r.nombreMorts != null && (
                      <span className="text-orange-600">-{r.nombreMorts} {t("ventes.detail.poissonsPerdus")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Invoice hint for EN_PREPARATION */}
      {!vente.facture && vente.statut === StatutVente.EN_PREPARATION && permissions.includes(Permission.VENTES_CREER) && (
        <p className="text-xs text-center text-muted-foreground py-2">
          {t("ventes.detail.factureApresLivraison")}
        </p>
      )}

      {/* Facture section */}
      {vente.facture && (
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
      )}

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
