"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Settings,
  CheckCheck,
  Package,
  ChevronRight,
  Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations, useLocale } from "next-intl";
import { StatutBesoins, UniteBesoin } from "@/types";
import { useDepenseService } from "@/services";
import { ModifierBesoinDialog } from "./modifier-besoin-dialog";

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const statutVariants: Record<
  StatutBesoins,
  "default" | "info" | "en_cours" | "terminee" | "annulee" | "warning"
> = {
  [StatutBesoins.SOUMISE]: "info",
  [StatutBesoins.APPROUVEE]: "en_cours",
  [StatutBesoins.TRAITEE]: "warning",
  [StatutBesoins.CLOTUREE]: "terminee",
  [StatutBesoins.REJETEE]: "annulee",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LigneBesoinData {
  id: string;
  designation: string;
  produitId: string | null;
  quantite: number;
  unite: UniteBesoin | null;
  prixEstime: number;
  prixReel: number | null;
  commandeId: string | null;
  produit: { id: string; nom: string; unite: string } | null;
  commande: { id: string; numero: string; statut: string } | null;
}

interface ListeBesoinsDetailData {
  id: string;
  numero: string;
  titre: string;
  statut: string;
  montantEstime: number;
  montantReel: number | null;
  motifRejet: string | null;
  notes: string | null;
  dateLimite: string | null;
  createdAt: string;
  demandeur: { id: string; name: string } | null;
  valideur: { id: string; name: string } | null;
  /** Vagues associees avec ratios (multi-vague) */
  vagues?: { id: string; vagueId: string; ratio: number; vague?: { id: string; code: string } | null }[];
  lignes: LigneBesoinData[];
  depenses: {
    id: string;
    numero: string;
    montantTotal: number;
    statut: string;
  }[];
}

interface Props {
  listeBesoins: ListeBesoinsDetailData;
  canApprove: boolean;
  canProcess: boolean;
  canEdit?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BesoinsDetailClient({
  listeBesoins: initial,
  canApprove,
  canProcess,
  canEdit = false,
}: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const depenseService = useDepenseService();
  const t = useTranslations("besoins");
  const tStock = useTranslations("stock");
  const locale = useLocale();
  const uniteLabel = (u: UniteBesoin | string | null): string => {
    if (!u) return "";
    return tStock(`unites.${u}` as Parameters<typeof tStock>[0]);
  };
  const [liste, setListe] = useState(initial);

  // Dialog states
  const [rejectOpen, setRejectOpen] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [traitOpen, setTraitOpen] = useState(false);
  const [clotureOpen, setClotureOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Traitement: action per ligne
  const [ligneActions, setLigneActions] = useState<
    Record<string, "COMMANDE" | "LIBRE">
  >(() =>
    Object.fromEntries(
      initial.lignes.map((l) => [
        l.id,
        l.produitId ? "COMMANDE" : "LIBRE",
      ])
    )
  );

  // Cloture: prixReel per ligne
  const [lignesPrixReel, setLignesPrixReel] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initial.lignes.map((l) => [
          l.id,
          l.prixReel !== null ? String(l.prixReel) : String(l.prixEstime),
        ])
      )
  );

  const statut = liste.statut as StatutBesoins;

  async function handleApprouver() {
    const result = await depenseService.approuverBesoin(liste.id);
    if (result.ok && result.data) {
      setListe(result.data as unknown as ListeBesoinsDetailData);
      queryClient.invalidateQueries({ queryKey: ["besoins"] });
    }
  }

  async function handleRejeter() {
    const result = await depenseService.rejeterBesoin(liste.id, {
      motif: motifRejet,
    });
    if (result.ok && result.data) {
      setListe(result.data as unknown as ListeBesoinsDetailData);
      setRejectOpen(false);
      setMotifRejet("");
      queryClient.invalidateQueries({ queryKey: ["besoins"] });
    }
  }

  async function handleTraiter() {
    const ligneActionsArr = Object.entries(ligneActions).map(
      ([ligneBesoinId, action]) => ({ ligneBesoinId, action })
    );
    const result = await depenseService.traiterBesoin(liste.id, {
      ligneActions: ligneActionsArr,
    });
    if (result.ok && result.data) {
      setListe(result.data as unknown as ListeBesoinsDetailData);
      setTraitOpen(false);
      queryClient.invalidateQueries({ queryKey: ["besoins"] });
    }
  }

  async function handleCloturer() {
    const lignesReelles = liste.lignes.map((l) => ({
      ligneBesoinId: l.id,
      prixReel: parseFloat(lignesPrixReel[l.id] ?? String(l.prixEstime)) || 0,
    }));
    const result = await depenseService.cloturerBesoin(liste.id, {
      lignesReelles,
    });
    if (result.ok && result.data) {
      setListe(result.data as unknown as ListeBesoinsDetailData);
      setClotureOpen(false);
      queryClient.invalidateQueries({ queryKey: ["besoins"] });
    }
  }

  const handleDelete = useCallback(async () => {
    const result = await depenseService.deleteBesoin(liste.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["besoins"] });
      router.push("/besoins");
    }
  }, [depenseService, liste.id, queryClient, router]);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Back nav */}
      <Link
        href="/besoins"
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.retour")}
      </Link>

      {/* Header card */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-xs text-muted-foreground font-mono">
                {liste.numero}
              </p>
              <h1 className="text-lg font-bold mt-0.5">{liste.titre}</h1>
            </div>
            <Badge
              variant={statutVariants[statut] ?? "default"}
              className="flex-shrink-0 mt-1"
            >
              {t(`statuts.${statut}` as Parameters<typeof t>[0])}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {liste.demandeur && (
              <div>
                <p className="text-xs text-muted-foreground">{t("detail.demandeur")}</p>
                <p className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {liste.demandeur.name}
                </p>
              </div>
            )}
            {liste.valideur && (
              <div>
                <p className="text-xs text-muted-foreground">{t("detail.valideur")}</p>
                <p className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {liste.valideur.name}
                </p>
              </div>
            )}
            {/* Vagues associees (multi-vague) */}
            {liste.vagues && liste.vagues.length > 0 ? (
              <div className={liste.vagues.length > 1 ? "col-span-2" : ""}>
                <p className="text-xs text-muted-foreground">{t("detail.vaguesAssociees")}</p>
                {liste.vagues.length === 1 ? (
                  <p className="text-primary font-medium">
                    {liste.vagues[0].vague?.code ?? liste.vagues[0].vagueId}
                  </p>
                ) : (
                  <ul className="space-y-0.5 mt-0.5">
                    {liste.vagues.map((lbv) => (
                      <li key={lbv.id} className="flex items-center justify-between text-sm">
                        <span className="text-primary font-medium">
                          {lbv.vague?.code ?? lbv.vagueId}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {Math.round(lbv.ratio * 1000) / 10} %
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">{t("detail.vague")}</p>
                <p className="text-xs text-muted-foreground italic">{t("detail.depenseGenerale")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t("detail.creeeLe")}</p>
              <p className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(liste.createdAt, locale)}
              </p>
            </div>
            {liste.dateLimite && (() => {
              const limite = new Date(liste.dateLimite);
              const now = new Date();
              const enRetard = limite < now && ![StatutBesoins.TRAITEE, StatutBesoins.CLOTUREE, StatutBesoins.REJETEE].includes(statut);
              return (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">{t("detail.dateLimite")}</p>
                  <p className={`flex items-center gap-1 text-sm font-medium ${enRetard ? "text-destructive" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    {formatDate(liste.dateLimite, locale)}
                    {enRetard && (
                      <span className="ml-1 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                        {t("detail.enRetard")}
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Montants */}
          <div className="mt-3 pt-3 flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("detail.montantEstime")}</p>
              <p className="text-base font-semibold">
                {formatMontant(liste.montantEstime, locale)} FCFA
              </p>
            </div>
            {liste.montantReel !== null && (
              <div>
                <p className="text-xs text-muted-foreground">{t("detail.montantReel")}</p>
                <p className="text-base font-semibold text-primary">
                  {formatMontant(liste.montantReel, locale)} FCFA
                </p>
              </div>
            )}
          </div>

          {/* Motif rejet */}
          {liste.motifRejet && (
            <div className="mt-3 pt-3">
              <p className="text-xs text-muted-foreground mb-1">{t("detail.motifRejet")}</p>
              <p className="text-sm text-destructive">{liste.motifRejet}</p>
            </div>
          )}

          {/* Notes */}
          {liste.notes && (
            <div className="mt-3 pt-3">
              <p className="text-xs text-muted-foreground mb-1">{t("detail.notes")}</p>
              <p className="text-sm">{liste.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bouton Modifier + Supprimer — seulement si statut SOUMISE et canEdit */}
      {canEdit && statut === StatutBesoins.SOUMISE && (
        <div className="mb-4 flex justify-end gap-2">
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" />
                {t("detail.supprimer")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("detail.supprimerTitle")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
              <p className="text-sm text-muted-foreground py-2">
                {t("detail.supprimerDescription", { numero: liste.numero })}
              </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{t("detail.annuler")}</Button>
                </DialogClose>
                <Button variant="danger" onClick={handleDelete}>
                  {t("detail.supprimer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ModifierBesoinDialog
            liste={liste}
            onSuccess={(updated) => {
              setListe(updated as ListeBesoinsDetailData);
            }}
          />
        </div>
      )}

      {/* Actions workflow */}
      {canApprove && statut === StatutBesoins.SOUMISE && (
        <div className="flex gap-2 mb-4">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleApprouver}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {t("detail.approuver")}
          </Button>
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger asChild>
              <Button variant="danger" className="flex-1">
                <XCircle className="h-4 w-4 mr-1" />
                {t("detail.rejeter")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("detail.rejeterTitle")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium">
                    {t("detail.motifRejetLabel")}
                  </label>
                  <Textarea
                    value={motifRejet}
                    onChange={(e) => setMotifRejet(e.target.value)}
                    placeholder={t("detail.motifRejetPlaceholder")}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{t("detail.annuler")}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleRejeter}
                >
                  {t("detail.confirmerRejet")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {canProcess && statut === StatutBesoins.APPROUVEE && (
        <Dialog open={traitOpen} onOpenChange={setTraitOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" className="w-full mb-4">
              <Settings className="h-4 w-4 mr-1" />
              {t("detail.traiter")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("detail.traiterTitle")}</DialogTitle>
            </DialogHeader>
            <DialogBody>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {t("detail.traiterDescription")}
              </p>
              {liste.lignes.map((l) => (
                <div key={l.id} className="border border-border rounded p-3 space-y-2">
                  <p className="text-sm font-medium">{l.designation}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.quantite} {uniteLabel(l.unite ?? l.produit?.unite ?? "")} &times;{" "}
                    {formatMontant(l.prixEstime, locale)} FCFA
                  </p>
                  <Select
                    value={ligneActions[l.id] ?? (l.produitId ? "COMMANDE" : "LIBRE")}
                    onValueChange={(v) =>
                      setLigneActions((prev) => ({
                        ...prev,
                        [l.id]: v as "COMMANDE" | "LIBRE",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMMANDE" disabled={!l.produitId}>
                        {t("detail.commandeFournisseur")}{!l.produitId ? ` ${t("detail.produitRequis")}` : ""}
                      </SelectItem>
                      <SelectItem value="LIBRE">{t("detail.achatDirect")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">{t("detail.annuler")}</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={handleTraiter}
              >
                {t("detail.confirmerTraitement")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canProcess && statut === StatutBesoins.TRAITEE && (
        <Dialog open={clotureOpen} onOpenChange={setClotureOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" className="w-full mb-4">
              <CheckCheck className="h-4 w-4 mr-1" />
              {t("detail.cloturer")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("detail.cloturerTitle")}</DialogTitle>
            </DialogHeader>
            <DialogBody>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {t("detail.cloturerDescription")}
              </p>
              {liste.lignes.map((l) => (
                <div key={l.id} className="border border-border rounded p-3 space-y-2">
                  <p className="text-sm font-medium">{l.designation}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("detail.quantite")} {l.quantite} {uniteLabel(l.unite ?? l.produit?.unite ?? "")}
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t("detail.prixReelLabel")}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={lignesPrixReel[l.id] ?? ""}
                      onChange={(e) =>
                        setLignesPrixReel((prev) => ({
                          ...prev,
                          [l.id]: e.target.value,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">{t("detail.annuler")}</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={handleCloturer}
              >
                {t("detail.confirmerCloture")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Lignes de besoin */}
      <Card className="mb-4">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">
            {t("detail.lignesTitle", { count: liste.lignes.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {liste.lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("detail.aucuneLigne")}
            </p>
          ) : (
            <div className="space-y-2">
              {liste.lignes.map((l) => (
                <div key={l.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{l.designation}</p>
                      {l.produit && (
                        <p className="text-xs text-muted-foreground">
                          {t("detail.produitLabel")} {l.produit.nom}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.quantite} {uniteLabel(l.unite ?? l.produit?.unite ?? "")}
                        {" "}×{" "}
                        {formatMontant(l.prixEstime, locale)} FCFA
                        {" = "}
                        <span className="font-medium">
                          {formatMontant(l.quantite * l.prixEstime, locale)} FCFA
                        </span>
                      </p>
                      {l.prixReel !== null && (
                        <p className="text-xs text-primary mt-0.5">
                          {t("detail.reelLabel")} {l.quantite} × {formatMontant(l.prixReel, locale)} ={" "}
                          {formatMontant(l.quantite * l.prixReel, locale)} FCFA
                        </p>
                      )}
                    </div>
                    {l.commande && (
                      <Link
                        href={`/stock/commandes/${l.commande.id}`}
                        className="flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge variant="info" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {l.commande.numero}
                          <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Badge>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Depenses liees */}
      {liste.depenses.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">
              {t("detail.depensesLiees", { count: liste.depenses.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {liste.depenses.map((d) => (
                <Link
                  key={d.id}
                  href={`/depenses/${d.id}`}
                  className="flex items-center justify-between p-2 border border-border rounded hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">
                      {d.numero}
                    </p>
                    <p className="text-sm font-medium">
                      {formatMontant(d.montantTotal, locale)} FCFA
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
