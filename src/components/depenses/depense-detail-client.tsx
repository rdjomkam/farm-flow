"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CreditCard,
  FileText,
  History,
  List,
  PencilLine,
  Pencil,
  Upload,
  ExternalLink,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ActionAjustementFrais, CategorieDepense, ModePaiement, MotifFraisSupp, StatutDepense } from "@/types";
import { useDepenseService } from "@/services";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const statutVariants: Record<
  StatutDepense,
  "default" | "warning" | "info" | "en_cours"
> = {
  [StatutDepense.NON_PAYEE]: "warning",
  [StatutDepense.PAYEE_PARTIELLEMENT]: "info",
  [StatutDepense.PAYEE]: "en_cours",
};

interface FraisData {
  id: string;
  motif: MotifFraisSupp;
  montant: number;
  notes: string | null;
  userId?: string | null;
  deletedAt?: string | null;
}

interface PaiementDepenseData {
  id: string;
  montant: number;
  mode: string;
  reference: string | null;
  date: string;
  user: { id: string; name: string };
  fraisSupp?: FraisData[];
}

interface DepenseData {
  id: string;
  numero: string;
  description: string;
  categorieDepense: string;
  montantTotal: number;
  montantPaye: number;
  montantFraisSupp: number;
  statut: string;
  date: string;
  dateEcheance: string | null;
  factureUrl: string | null;
  notes: string | null;
  commandeId: string | null;
  vagueId: string | null;
  listeBesoinsId?: string | null;
  commande: { id: string; numero: string; statut: string } | null;
  vague: { id: string; code: string } | null;
  listeBesoins?: { id: string; numero: string; titre: string } | null;
  user: { id: string; name: string };
  paiements: PaiementDepenseData[];
  ajustements?: AjustementData[];
  lignes?: LigneDepenseData[];
}

interface LigneDepenseData {
  id: string;
  designation: string;
  categorieDepense: string;
  quantite: number;
  prixUnitaire: number;
  montantTotal: number;
  produit: { id: string; nom: string } | null;
}

interface AjustementData {
  id: string;
  montantAvant: number;
  montantApres: number;
  raison: string;
  user: { id: string; name: string };
  createdAt: string;
}

interface FraisSuppRow {
  motif: string;
  montant: string;
  notes: string;
}

interface Props {
  depense: DepenseData;
  canEdit: boolean;
  canPay: boolean;
  canDelete: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(montant: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(montant)) + " FCFA";
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepenseDetailClient({ depense, canEdit, canPay, canDelete }: Props) {
  const t = useTranslations("depenses");
  const locale = useLocale();
  const router = useRouter();
  const depenseService = useDepenseService();
  const { toast } = useToast();

  const [currentDepense, setCurrentDepense] = useState(depense);
  const [paiements, setPaiements] = useState<PaiementDepenseData[]>(
    depense.paiements
  );
  const [ajustements, setAjustements] = useState<AjustementData[]>(
    depense.ajustements ?? []
  );
  const lignes = currentDepense.lignes ?? [];

  // Paiement form state
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [paiementMontant, setPaiementMontant] = useState("");
  const [paiementMode, setPaiementMode] = useState<ModePaiement>(
    ModePaiement.ESPECES
  );
  const [paiementRef, setPaiementRef] = useState("");
  const [paiementPending, setPaiementPending] = useState(false);

  // Frais supplementaires state
  const [fraisSupp, setFraisSupp] = useState<FraisSuppRow[]>([]);

  // Ajustement form state
  const [ajustementOpen, setAjustementOpen] = useState(false);

  const [ajustementMontant, setAjustementMontant] = useState("");
  const [ajustementRaison, setAjustementRaison] = useState("");
  const [ajustementPending, setAjustementPending] = useState(false);

  // Frais adjustment state
  const [fraisAjoutOpen, setFraisAjoutOpen] = useState(false);
  const [fraisAjoutPaiementId, setFraisAjoutPaiementId] = useState("");
  const [fraisAjoutMotif, setFraisAjoutMotif] = useState<MotifFraisSupp>(MotifFraisSupp.TRANSPORT);
  const [fraisAjoutMontant, setFraisAjoutMontant] = useState("");
  const [fraisAjoutNotes, setFraisAjoutNotes] = useState("");
  const [fraisAjoutRaison, setFraisAjoutRaison] = useState("");
  const [fraisAjoutPending, setFraisAjoutPending] = useState(false);

  const [fraisEditTarget, setFraisEditTarget] = useState<{ fraisId: string; paiementId: string; motif: MotifFraisSupp; montant: number; notes: string | null } | null>(null);
  const [fraisEditMotif, setFraisEditMotif] = useState<MotifFraisSupp>(MotifFraisSupp.TRANSPORT);
  const [fraisEditMontant, setFraisEditMontant] = useState("");
  const [fraisEditNotes, setFraisEditNotes] = useState("");
  const [fraisEditRaison, setFraisEditRaison] = useState("");
  const [fraisEditPending, setFraisEditPending] = useState(false);

  const [fraisDeleteTarget, setFraisDeleteTarget] = useState<{ fraisId: string; paiementId: string } | null>(null);
  const [fraisDeleteRaison, setFraisDeleteRaison] = useState("");
  const [fraisDeletePending, setFraisDeletePending] = useState(false);

  // Delete paiement state
  const [paiementDeleteTarget, setPaiementDeleteTarget] = useState<string | null>(null);
  const [paiementDeletePending, setPaiementDeletePending] = useState(false);

  // Upload facture state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Delete facture
  const [deleteFactureOpen, setDeleteFactureOpen] = useState(false);

  // Delete depense
  const [deleteDepenseOpen, setDeleteDepenseOpen] = useState(false);
  const [deleteDepensePending, setDeleteDepensePending] = useState(false);

  const statut = currentDepense.statut as StatutDepense;
  const categorie = currentDepense.categorieDepense as CategorieDepense;
  const resteAPayer = currentDepense.montantTotal - currentDepense.montantPaye;
  const pctPaye =
    currentDepense.montantTotal > 0
      ? Math.min(
          100,
          Math.round(
            (currentDepense.montantPaye / currentDepense.montantTotal) * 100
          )
        )
      : 0;

  const canAddPaiement = canPay && statut !== StatutDepense.PAYEE;

  // Computed frais totals
  const totalFrais = fraisSupp.reduce((sum, f) => {
    const v = parseFloat(f.montant);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
  const totalPaiement = (parseFloat(paiementMontant) || 0) + totalFrais;

  const coutRealTotal =
    currentDepense.montantTotal + (currentDepense.montantFraisSupp ?? 0);

  // -------------------------------------------------------------------------
  // Frais rows helpers
  // -------------------------------------------------------------------------

  function addFraisRow() {
    setFraisSupp((prev) => [
      ...prev,
      { motif: MotifFraisSupp.TRANSPORT, montant: "", notes: "" },
    ]);
  }

  function removeFraisRow(index: number) {
    setFraisSupp((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFraisRow(index: number, field: keyof FraisSuppRow, value: string) {
    setFraisSupp((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function handlePaiement() {
    const montant = parseFloat(paiementMontant);
    if (isNaN(montant) || montant <= 0) {
      toast({ title: t("errors.montantInvalide"), variant: "error" });
      return;
    }

    const fraisSuppData = fraisSupp
      .filter((f) => f.montant && parseFloat(f.montant) > 0 && f.motif)
      .map((f) => ({
        motif: f.motif as MotifFraisSupp,
        montant: parseFloat(f.montant),
        notes: f.notes || undefined,
      }));

    setPaiementPending(true);
    try {
      const result = await depenseService.addPaiementDepense(currentDepense.id, {
        montant,
        mode: paiementMode,
        reference: paiementRef.trim() || undefined,
        fraisSupp: fraisSuppData.length > 0 ? fraisSuppData : undefined,
      });
      if (result.ok && result.data) {
        const p = result.data.paiement;
        const newPaiement: PaiementDepenseData = {
          id: p.id,
          montant: p.montant,
          mode: p.mode,
          reference: p.reference,
          date: typeof p.date === "string" ? p.date : (p.date as unknown as Date).toISOString(),
          user: p.user,
          fraisSupp: p.fraisSupp?.map((f) => ({
            id: f.id,
            motif: f.motif,
            montant: f.montant,
            notes: f.notes,
          })),
        };
        setPaiements((prev) => [newPaiement, ...prev]);
        setCurrentDepense((prev) => ({
          ...prev,
          montantPaye: result.data!.montantPaye,
          statut: result.data!.statut,
          montantFraisSupp: result.data!.montantFraisSupp,
        }));
        setPaiementOpen(false);
        setPaiementMontant("");
        setPaiementRef("");
        setFraisSupp([]);
      }
    } finally {
      setPaiementPending(false);
    }
  }

  async function handleUploadFacture() {
    if (!uploadFile) return;
    const result = await depenseService.uploadFactureDepense(
      currentDepense.id,
      uploadFile
    );
    if (result.ok) {
      setCurrentDepense((prev) => ({
        ...prev,
        factureUrl: "uploaded",
      }));
      setUploadOpen(false);
      setUploadFile(null);
    }
  }

  async function handleVoirFacture() {
    const result = await depenseService.getFactureDepenseUrl(currentDepense.id);
    if (result.ok && result.data) {
      window.open(result.data.url, "_blank");
    }
  }

  async function handleDeleteFacture() {
    const result = await depenseService.deleteFactureDepense(currentDepense.id);
    if (result.ok) {
      setCurrentDepense((prev) => ({ ...prev, factureUrl: null }));
      setDeleteFactureOpen(false);
    }
  }

  async function handleDeleteDepense() {
    setDeleteDepensePending(true);
    try {
      const result = await depenseService.deleteDepense(currentDepense.id);
      if (result.ok) {
        router.push("/depenses");
      }
    } finally {
      setDeleteDepensePending(false);
    }
  }

  async function handleAjustement() {
    const montant = parseFloat(ajustementMontant);
    if (isNaN(montant) || montant <= 0) {
      toast({ title: t("ajustement.montantInvalide"), variant: "error" });
      return;
    }
    if (!ajustementRaison.trim()) {
      toast({ title: t("ajustement.raisonRequise"), variant: "error" });
      return;
    }
    if (montant < currentDepense.montantPaye) {
      toast({ title: t("ajustement.montantInferieur"), variant: "error" });
      return;
    }

    setAjustementPending(true);
    try {
      const result = await depenseService.ajusterDepense(currentDepense.id, {
        montantTotal: montant,
        raison: ajustementRaison.trim(),
      });
      if (result.ok && result.data) {
        const a = result.data.ajustement;
        const newAjustement: AjustementData = {
          id: a.id,
          montantAvant: a.montantAvant,
          montantApres: a.montantApres,
          raison: a.raison,
          user: a.user,
          createdAt:
            typeof a.createdAt === "string"
              ? a.createdAt
              : (a.createdAt as unknown as Date).toISOString(),
        };
        setAjustements((prev) => [newAjustement, ...prev]);
        setCurrentDepense((prev) => ({
          ...prev,
          montantTotal: montant,
          statut: result.data!.depense.statut,
        }));
        setAjustementOpen(false);
        setAjustementMontant("");
        setAjustementRaison("");
      }
    } finally {
      setAjustementPending(false);
    }
  }

  // -------------------------------------------------------------------------
  // Frais adjustment handlers
  // -------------------------------------------------------------------------

  async function handleFraisAjout() {
    const montant = parseFloat(fraisAjoutMontant);
    if (isNaN(montant) || montant <= 0) {
      toast({ title: t("ajustement.montantInvalide"), variant: "error" });
      return;
    }
    if (!fraisAjoutPaiementId) {
      toast({ title: t("ajustement.selectPaiement"), variant: "error" });
      return;
    }
    if (!fraisAjoutRaison.trim()) {
      toast({ title: t("ajustement.raisonRequise"), variant: "error" });
      return;
    }
    setFraisAjoutPending(true);
    try {
      const result = await depenseService.ajusterFraisDepense(currentDepense.id, {
        paiementId: fraisAjoutPaiementId,
        action: ActionAjustementFrais.AJOUTE,
        motif: fraisAjoutMotif,
        montant,
        notes: fraisAjoutNotes.trim() || null,
        raison: fraisAjoutRaison.trim(),
      });
      if (result.ok && result.data) {
        // Update paiements state with the new frais
        if (result.data.frais) {
          const newFrais = result.data.frais as FraisData;
          setPaiements((prev) =>
            prev.map((p) =>
              p.id === fraisAjoutPaiementId
                ? { ...p, fraisSupp: [...(p.fraisSupp ?? []), newFrais] }
                : p
            )
          );
        }
        setCurrentDepense((prev) => ({
          ...prev,
          montantFraisSupp: result.data!.montantFraisSupp,
        }));
        setFraisAjoutOpen(false);
        setFraisAjoutPaiementId("");
        setFraisAjoutMotif(MotifFraisSupp.TRANSPORT);
        setFraisAjoutMontant("");
        setFraisAjoutNotes("");
        setFraisAjoutRaison("");
        toast({ title: t("ajustement.fraisAjoute"), variant: "success" });
      }
    } finally {
      setFraisAjoutPending(false);
    }
  }

  async function handleFraisEdit() {
    if (!fraisEditTarget) return;
    const montant = parseFloat(fraisEditMontant);
    if (isNaN(montant) || montant <= 0) {
      toast({ title: t("ajustement.montantInvalide"), variant: "error" });
      return;
    }
    if (!fraisEditRaison.trim()) {
      toast({ title: t("ajustement.raisonRequise"), variant: "error" });
      return;
    }
    setFraisEditPending(true);
    try {
      const result = await depenseService.ajusterFraisDepense(currentDepense.id, {
        paiementId: fraisEditTarget.paiementId,
        action: ActionAjustementFrais.MODIFIE,
        fraisId: fraisEditTarget.fraisId,
        motif: fraisEditMotif,
        montant,
        notes: fraisEditNotes.trim() || null,
        raison: fraisEditRaison.trim(),
      });
      if (result.ok && result.data) {
        // Replace the old frais with the new one in state
        const newFrais = result.data.frais as FraisData | null;
        setPaiements((prev) =>
          prev.map((p) =>
            p.id === fraisEditTarget.paiementId
              ? {
                  ...p,
                  fraisSupp: [
                    ...(p.fraisSupp ?? []).filter((f) => f.id !== fraisEditTarget.fraisId),
                    ...(newFrais ? [newFrais] : []),
                  ],
                }
              : p
          )
        );
        setCurrentDepense((prev) => ({
          ...prev,
          montantFraisSupp: result.data!.montantFraisSupp,
        }));
        setFraisEditTarget(null);
        setFraisEditRaison("");
        toast({ title: t("ajustement.fraisModifie"), variant: "success" });
      }
    } finally {
      setFraisEditPending(false);
    }
  }

  async function handleFraisDelete() {
    if (!fraisDeleteTarget) return;
    if (!fraisDeleteRaison.trim()) {
      toast({ title: t("ajustement.raisonRequise"), variant: "error" });
      return;
    }
    setFraisDeletePending(true);
    try {
      const result = await depenseService.ajusterFraisDepense(currentDepense.id, {
        paiementId: fraisDeleteTarget.paiementId,
        action: ActionAjustementFrais.SUPPRIME,
        fraisId: fraisDeleteTarget.fraisId,
        raison: fraisDeleteRaison.trim(),
      });
      if (result.ok && result.data) {
        // Remove the deleted frais from state
        setPaiements((prev) =>
          prev.map((p) =>
            p.id === fraisDeleteTarget.paiementId
              ? {
                  ...p,
                  fraisSupp: (p.fraisSupp ?? []).filter(
                    (f) => f.id !== fraisDeleteTarget.fraisId
                  ),
                }
              : p
          )
        );
        setCurrentDepense((prev) => ({
          ...prev,
          montantFraisSupp: result.data!.montantFraisSupp,
        }));
        setFraisDeleteTarget(null);
        setFraisDeleteRaison("");
        toast({ title: t("ajustement.fraisSupprime"), variant: "success" });
      }
    } finally {
      setFraisDeletePending(false);
    }
  }

  async function handlePaiementDelete() {
    if (!paiementDeleteTarget) return;
    setPaiementDeletePending(true);
    try {
      const result = await depenseService.deletePaiementDepense(
        currentDepense.id,
        paiementDeleteTarget
      );
      if (result.ok && result.data) {
        setPaiements((prev) => prev.filter((p) => p.id !== paiementDeleteTarget));
        setCurrentDepense((prev) => ({
          ...prev,
          montantPaye: result.data!.montantPaye,
          statut: result.data!.statut,
          montantFraisSupp: result.data!.montantFraisSupp,
        }));
        setPaiementDeleteTarget(null);
        toast({ title: t("paiements.paiementSupprime"), variant: "success" });
      }
    } finally {
      setPaiementDeletePending(false);
    }
  }

  // Collect all active frais across all payments
  const allActiveFrais = paiements.flatMap((p) =>
    (p.fraisSupp ?? [])
      .filter((f) => !("deletedAt" in f) || f.deletedAt == null)
      .map((f) => ({ ...f, paiementDate: p.date, paiementId: p.id }))
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back link + delete */}
      <div className="flex items-center justify-between">
        <Link
          href="/depenses"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.retour")}
        </Link>

        {canDelete && statut === StatutDepense.NON_PAYEE && (
          <Dialog open={deleteDepenseOpen} onOpenChange={setDeleteDepenseOpen}>
            <DialogTrigger asChild>
              <Button variant="danger" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                {t("deleteDepense.supprimer")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteDepense.title")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <p className="text-sm text-muted-foreground">
                  {t("deleteDepense.description")}
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("detail.annuler")}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleDeleteDepense}
                  disabled={deleteDepensePending}
                >
                  {deleteDepensePending
                    ? t("detail.enCours")
                    : t("deleteDepense.confirmer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {currentDepense.numero}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentDepense.description}
              </p>
            </div>
            <Badge variant={statutVariants[statut]}>
              {t(`statuts.${statut}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Categorie */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("detail.categorie")}
            </span>
            <Badge variant="default">{t(`categories.${categorie}`)}</Badge>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t("detail.date")}
            </span>
            <span>{formatDate(currentDepense.date, locale)}</span>
          </div>

          {/* Echeance */}
          {currentDepense.dateEcheance && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t("detail.echeance")}
              </span>
              <span>{formatDate(currentDepense.dateEcheance, locale)}</span>
            </div>
          )}

          {/* Commande */}
          {currentDepense.commande && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.commande")}
              </span>
              <Link
                href={`/stock/commandes/${currentDepense.commande.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.commande.numero}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Vague */}
          {currentDepense.vague && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("detail.vague")}</span>
              <Link
                href={`/vagues/${currentDepense.vague.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.vague.code}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Liste de besoins */}
          {currentDepense.listeBesoins && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.listeBesoins")}
              </span>
              <Link
                href={`/besoins/${currentDepense.listeBesoins.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.listeBesoins.numero}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Notes */}
          {currentDepense.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground block mb-1">
                {t("detail.notes")}
              </span>
              <p className="text-sm bg-muted/50 rounded p-2">
                {currentDepense.notes}
              </p>
            </div>
          )}

          {/* Separateur */}
          <div className="border-t border-border" />

          {/* Montants */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.montantTotal")}
              </span>
              <span className="font-semibold">
                {formatMontant(currentDepense.montantTotal, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.dejaPaye")}
              </span>
              <span className="font-semibold text-primary">
                {formatMontant(currentDepense.montantPaye, locale)}
              </span>
            </div>
            {statut !== StatutDepense.PAYEE && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("detail.resteAPayer")}
                </span>
                <span className="font-semibold text-warning">
                  {formatMontant(resteAPayer, locale)}
                </span>
              </div>
            )}
            {(currentDepense.montantFraisSupp ?? 0) > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("detail.fraisSupp")}
                  </span>
                  <span className="font-semibold text-muted-foreground">
                    {formatMontant(currentDepense.montantFraisSupp, locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                  <span className="font-medium">
                    {t("detail.coutReelTotal")}
                  </span>
                  <span className="font-bold">
                    {formatMontant(coutRealTotal, locale)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Barre de progression */}
          {statut !== StatutDepense.NON_PAYEE && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pctPaye}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {pctPaye}%
              </span>
            </div>
          )}

          {/* CTA ajustement montant / frais */}
          {canEdit && (
            <Dialog open={ajustementOpen} onOpenChange={setAjustementOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() =>
                    setAjustementMontant(
                      String(currentDepense.montantTotal)
                    )
                  }
                >
                  <PencilLine className="h-4 w-4" />
                  {t("ajustement.title")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("ajustement.title")}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  {/* Current amount display */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <span className="text-sm text-muted-foreground">{t("ajustement.montantActuel")}</span>
                    <span className="text-sm font-semibold">{formatMontant(currentDepense.montantTotal, locale)}</span>
                  </div>

                  {/* New amount */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="ajustement-montant"
                      className="text-sm font-medium"
                    >
                      {t("ajustement.montantLabel")}
                    </label>
                    <Input
                      id="ajustement-montant"
                      type="number"
                      min={currentDepense.montantPaye || 1}
                      value={ajustementMontant}
                      onChange={(e) => setAjustementMontant(e.target.value)}
                      placeholder="0"
                    />
                    {currentDepense.montantPaye > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("ajustement.montantMinInfo", {
                          min: formatMontant(currentDepense.montantPaye, locale),
                        })}
                      </p>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="ajustement-raison"
                      className="text-sm font-medium"
                    >
                      {t("ajustement.raisonLabel")}
                    </label>
                    <textarea
                      id="ajustement-raison"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      value={ajustementRaison}
                      onChange={(e) => setAjustementRaison(e.target.value)}
                      placeholder={t("ajustement.raisonPlaceholder")}
                    />
                  </div>

                  {/* Frais section */}
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("detail.fraisSupp")}
                        {allActiveFrais.length > 0 && (
                          <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                            {allActiveFrais.length}
                          </span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => {
                          setFraisAjoutOpen(true);
                          setFraisAjoutPaiementId(paiements[0]?.id ?? "");
                          setFraisAjoutMotif(MotifFraisSupp.TRANSPORT);
                          setFraisAjoutMontant("");
                          setFraisAjoutNotes("");
                          setFraisAjoutRaison("");
                        }}
                        disabled={paiements.length === 0}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("ajustement.ajouterFrais")}
                      </Button>
                    </div>
                    {allActiveFrais.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {t("ajustement.aucunFrais")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {allActiveFrais.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-md"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="default" className="text-xs">
                                  {t(`motif.${f.motif}`)}
                                </Badge>
                                <span className="text-sm font-semibold">
                                  {formatMontant(f.montant, locale)}
                                </span>
                              </div>
                              {f.notes && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {f.notes}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {t("ajustement.paiementDu")} {formatDate(f.paiementDate, locale)}
                              </span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setFraisEditTarget({ fraisId: f.id, paiementId: f.paiementId, motif: f.motif as MotifFraisSupp, montant: f.montant, notes: f.notes });
                                  setFraisEditMotif(f.motif as MotifFraisSupp);
                                  setFraisEditMontant(String(f.montant));
                                  setFraisEditNotes(f.notes ?? "");
                                  setFraisEditRaison("");
                                }}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={t("ajustement.modifierFrais")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFraisDeleteTarget({ fraisId: f.id, paiementId: f.paiementId });
                                  setFraisDeleteRaison("");
                                }}
                                className="p-1.5 rounded hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                                aria-label={t("ajustement.supprimerFrais")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("detail.annuler")}</Button>
                  </DialogClose>
                  <Button
                    onClick={handleAjustement}
                    disabled={
                      ajustementPending ||
                      !ajustementMontant ||
                      parseFloat(ajustementMontant) <= 0 ||
                      !ajustementRaison.trim()
                    }
                  >
                    {ajustementPending
                      ? t("ajustement.enCours")
                      : t("ajustement.confirmer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* CTA paiement */}
          {canAddPaiement && (
            <Dialog open={paiementOpen} onOpenChange={setPaiementOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  {t("detail.ajouterPaiement")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("detail.paiementTitle")}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  {/* Montant */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="paiement-montant"
                      className="text-sm font-medium"
                    >
                      {t("detail.montantLabel")}
                    </label>
                    <Input
                      id="paiement-montant"
                      type="number"
                      min={1}
                      value={paiementMontant}
                      onChange={(e) => setPaiementMontant(e.target.value)}
                      placeholder={t("detail.montantMax", {
                        max: formatMontant(resteAPayer, locale),
                      })}
                    />
                  </div>

                  {/* Mode */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="paiement-mode"
                      className="text-sm font-medium"
                    >
                      {t("detail.modeLabel")}
                    </label>
                    <Select
                      value={paiementMode}
                      onValueChange={(v) => setPaiementMode(v as ModePaiement)}
                    >
                      <SelectTrigger id="paiement-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ModePaiement).map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {t(`modes.${mode}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="paiement-ref"
                      className="text-sm font-medium"
                    >
                      {t("detail.referenceLabel")}
                    </label>
                    <Input
                      id="paiement-ref"
                      value={paiementRef}
                      onChange={(e) => setPaiementRef(e.target.value)}
                      placeholder={t("detail.referencePlaceholder")}
                    />
                  </div>

                  {/* Frais supplementaires section */}
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {t("detail.fraisSupp")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={addFraisRow}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("detail.ajouterFrais")}
                      </Button>
                    </div>

                    {fraisSupp.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {fraisSupp.map((row, index) => (
                          <div
                            key={index}
                            className="flex flex-col gap-2 p-2.5 bg-muted/40 rounded-md relative"
                          >
                            <button
                              type="button"
                              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => removeFraisRow(index)}
                              aria-label={t("detail.supprimerFrais")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>

                            {/* Motif select */}
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">
                                {t("detail.motif")}
                              </label>
                              <Select
                                value={row.motif}
                                onValueChange={(v) =>
                                  updateFraisRow(index, "motif", v)
                                }
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.values(MotifFraisSupp).map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {t(`motif.${m}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Montant */}
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">
                                {t("detail.montantLabel")}
                              </label>
                              <Input
                                type="number"
                                min={1}
                                className="h-8 text-sm"
                                value={row.montant}
                                onChange={(e) =>
                                  updateFraisRow(index, "montant", e.target.value)
                                }
                                placeholder="0"
                              />
                            </div>

                            {/* Notes optionnelles */}
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">
                                {t("detail.notesOptionnel")}
                              </label>
                              <Input
                                className="h-8 text-sm"
                                value={row.notes}
                                onChange={(e) =>
                                  updateFraisRow(index, "notes", e.target.value)
                                }
                                placeholder={t("detail.fraisNotesPlaceholder")}
                              />
                            </div>
                          </div>
                        ))}

                        {/* Totaux */}
                        <div className="flex flex-col gap-1 text-sm border-t border-border pt-2">
                          {totalFrais > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>{t("detail.totalFrais")}</span>
                              <span>{formatMontant(totalFrais, locale)}</span>
                            </div>
                          )}
                          {totalPaiement > 0 && (
                            <div className="flex justify-between font-semibold">
                              <span>{t("detail.totalPaiement")}</span>
                              <span>{formatMontant(totalPaiement, locale)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("detail.annuler")}</Button>
                  </DialogClose>
                  <Button
                    onClick={handlePaiement}
                    disabled={
                      paiementPending ||
                      !paiementMontant ||
                      parseFloat(paiementMontant) <= 0
                    }
                  >
                    {paiementPending
                      ? t("detail.enCours")
                      : t("detail.confirmer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* Facture fournisseur */}
      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("detail.factureFournisseur")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {currentDepense.factureUrl ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={handleVoirFacture}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("detail.voirFacture")}
                  </Button>
                  <Dialog
                    open={deleteFactureOpen}
                    onOpenChange={setDeleteFactureOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-danger border-danger/30 hover:bg-danger/5"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("detail.supprimer")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {t("detail.supprimerTitle")}
                        </DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        {t("detail.supprimerFactureDescription")}
                      </p>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">
                            {t("detail.annuler")}
                          </Button>
                        </DialogClose>
                        <Button variant="danger" onClick={handleDeleteFacture}>
                          {t("detail.supprimer")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Upload className="h-4 w-4" />
                    {t("detail.joindreFacture")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("detail.uploadLabel")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {t("detail.uploadHint")}
                    </p>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{t("detail.annuler")}</Button>
                    </DialogClose>
                    <Button onClick={handleUploadFacture} disabled={!uploadFile}>
                      {t("detail.envoyer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lignes de detail */}
      {lignes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <List className="h-4 w-4" />
              {t("lignes.titre", { count: lignes.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {lignes.map((l) => (
                <div key={l.id} className="flex flex-col gap-1 pb-3 last:pb-0">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{l.designation}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`categories.${l.categorieDepense}`)}
                      </span>
                    </div>
                    <span className="font-medium shrink-0">{formatMontant(l.montantTotal, locale)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {l.quantite} × {formatMontant(l.prixUnitaire, locale)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique des paiements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t("detail.historiqueTitle", { count: paiements.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paiements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("detail.aucunPaiement")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {paiements.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-1.5 border-b border-border last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">
                        {formatMontant(p.montant, locale)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`modes.${p.mode as ModePaiement}`)} •{" "}
                        {p.user.name}
                      </span>
                      {p.reference && (
                        <span className="text-xs text-muted-foreground">
                          {t("detail.reference")} {p.reference}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(p.date, locale)}
                      </span>
                      {canPay && (
                        <button
                          type="button"
                          onClick={() => setPaiementDeleteTarget(p.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                          aria-label={t("paiements.supprimerPaiement")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Frais supplementaires du paiement */}
                  {p.fraisSupp && p.fraisSupp.length > 0 && (
                    <div className="flex flex-col gap-0.5 ml-2 pl-2 border-l-2 border-border">
                      {p.fraisSupp.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span>{t(`motif.${f.motif}`)}</span>
                          <span className="font-medium">
                            + {formatMontant(f.montant, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Dialog: Ajouter un frais (dans l'onglet Frais de l'ajustement) */}
      <Dialog open={fraisAjoutOpen} onOpenChange={setFraisAjoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ajustement.ajouterFrais")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {/* Paiement */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-ajout-paiement" className="text-sm font-medium">{t("ajustement.selectPaiement")}</label>
              <Select value={fraisAjoutPaiementId} onValueChange={setFraisAjoutPaiementId}>
                <SelectTrigger id="frais-ajout-paiement">
                  <SelectValue placeholder={t("ajustement.selectPaiement")} />
                </SelectTrigger>
                <SelectContent>
                  {paiements.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {formatMontant(p.montant, locale)} — {formatDate(p.date, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Motif */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-ajout-motif" className="text-sm font-medium">{t("detail.motif")}</label>
              <Select value={fraisAjoutMotif} onValueChange={(v) => setFraisAjoutMotif(v as MotifFraisSupp)}>
                <SelectTrigger id="frais-ajout-motif">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(MotifFraisSupp).map((m) => (
                    <SelectItem key={m} value={m}>{t(`motif.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Montant */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-ajout-montant" className="text-sm font-medium">{t("detail.montantLabel")}</label>
              <Input
                id="frais-ajout-montant"
                type="number"
                min={1}
                value={fraisAjoutMontant}
                onChange={(e) => setFraisAjoutMontant(e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-ajout-notes" className="text-sm font-medium">{t("detail.notesOptionnel")}</label>
              <Input
                id="frais-ajout-notes"
                value={fraisAjoutNotes}
                onChange={(e) => setFraisAjoutNotes(e.target.value)}
                placeholder={t("detail.fraisNotesPlaceholder")}
              />
            </div>
            {/* Raison */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-ajout-raison" className="text-sm font-medium">{t("ajustement.raisonLabel")}</label>
              <textarea
                id="frais-ajout-raison"
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                value={fraisAjoutRaison}
                onChange={(e) => setFraisAjoutRaison(e.target.value)}
                placeholder={t("ajustement.raisonPlaceholder")}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("detail.annuler")}</Button>
            </DialogClose>
            <Button
              onClick={handleFraisAjout}
              disabled={
                fraisAjoutPending ||
                !fraisAjoutPaiementId ||
                !fraisAjoutMontant ||
                parseFloat(fraisAjoutMontant) <= 0 ||
                !fraisAjoutRaison.trim()
              }
            >
              {fraisAjoutPending ? t("ajustement.enCours") : t("ajustement.ajouterFrais")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Modifier un frais */}
      <Dialog open={!!fraisEditTarget} onOpenChange={(open) => { if (!open) setFraisEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ajustement.modifierFrais")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {/* Motif */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-edit-motif" className="text-sm font-medium">{t("detail.motif")}</label>
              <Select value={fraisEditMotif} onValueChange={(v) => setFraisEditMotif(v as MotifFraisSupp)}>
                <SelectTrigger id="frais-edit-motif">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(MotifFraisSupp).map((m) => (
                    <SelectItem key={m} value={m}>{t(`motif.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Montant */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-edit-montant" className="text-sm font-medium">{t("detail.montantLabel")}</label>
              <Input
                id="frais-edit-montant"
                type="number"
                min={1}
                value={fraisEditMontant}
                onChange={(e) => setFraisEditMontant(e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-edit-notes" className="text-sm font-medium">{t("detail.notesOptionnel")}</label>
              <Input
                id="frais-edit-notes"
                value={fraisEditNotes}
                onChange={(e) => setFraisEditNotes(e.target.value)}
                placeholder={t("detail.fraisNotesPlaceholder")}
              />
            </div>
            {/* Raison */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-edit-raison" className="text-sm font-medium">{t("ajustement.raisonLabel")}</label>
              <textarea
                id="frais-edit-raison"
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                value={fraisEditRaison}
                onChange={(e) => setFraisEditRaison(e.target.value)}
                placeholder={t("ajustement.raisonPlaceholder")}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setFraisEditTarget(null)}>{t("detail.annuler")}</Button>
            </DialogClose>
            <Button
              onClick={handleFraisEdit}
              disabled={
                fraisEditPending ||
                !fraisEditMontant ||
                parseFloat(fraisEditMontant) <= 0 ||
                !fraisEditRaison.trim()
              }
            >
              {fraisEditPending ? t("ajustement.enCours") : t("ajustement.modifierFrais")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Supprimer un frais */}
      <Dialog open={!!fraisDeleteTarget} onOpenChange={(open) => { if (!open) setFraisDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ajustement.supprimerFrais")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frais-delete-raison" className="text-sm font-medium">{t("ajustement.raisonLabel")}</label>
              <textarea
                id="frais-delete-raison"
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                value={fraisDeleteRaison}
                onChange={(e) => setFraisDeleteRaison(e.target.value)}
                placeholder={t("ajustement.raisonPlaceholder")}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setFraisDeleteTarget(null)}>{t("detail.annuler")}</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={handleFraisDelete}
              disabled={fraisDeletePending || !fraisDeleteRaison.trim()}
            >
              {fraisDeletePending ? t("ajustement.enCours") : t("ajustement.supprimerFrais")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Supprimer un paiement */}
      <Dialog
        open={!!paiementDeleteTarget}
        onOpenChange={(open) => {
          if (!open) setPaiementDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("paiements.supprimerPaiement")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {t("paiements.confirmeSuppression")}
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setPaiementDeleteTarget(null)}>
                {t("detail.annuler")}
              </Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={handlePaiementDelete}
              disabled={paiementDeletePending}
            >
              {paiementDeletePending
                ? t("ajustement.enCours")
                : t("paiements.supprimerPaiement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historique des ajustements */}
      {ajustements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("ajustement.historique")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {ajustements.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 border-b border-border last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                    <span>{a.user.name}</span>
                    <span className="shrink-0">{formatDate(a.createdAt, locale)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium flex-wrap">
                    <span>{formatMontant(a.montantAvant, locale)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-primary">
                      {formatMontant(a.montantApres, locale)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.raison}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
