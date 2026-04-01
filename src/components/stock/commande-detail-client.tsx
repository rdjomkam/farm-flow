"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  Calendar,
  Truck,
  Send,
  PackageCheck,
  X,
  FileText,
  ImageIcon,
  Upload,
  Eye,
  Trash2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { StatutCommande, Permission } from "@/types";
import { useStockService } from "@/services";
import { ShareCommandeButton } from "@/components/stock/share-commande-button";
import { ReceptionCommandeDialog } from "@/components/stock/reception-commande-dialog";

const statutVariants: Record<StatutCommande, "default" | "info" | "en_cours" | "warning"> = {
  [StatutCommande.BROUILLON]: "default",
  [StatutCommande.ENVOYEE]: "info",
  [StatutCommande.LIVREE]: "en_cours",
  [StatutCommande.ANNULEE]: "warning",
};

interface LigneData {
  id: string;
  quantite: number;
  quantiteRecue: number | null;
  prixUnitaire: number;
  produit: { id: string; nom: string; unite: string; uniteAchat: string | null; contenance: number | null };
}

interface CommandeData {
  id: string;
  numero: string;
  statut: string;
  dateCommande: string;
  dateLivraison: string | null;
  montantTotal: number;
  montantRecu: number | null;
  factureUrl: string | null;
  fournisseur: {
    id: string;
    nom: string;
    telephone: string | null;
    email: string | null;
  };
  user: { id: string; name: string };
  lignes: LigneData[];
}

interface Props {
  commande: CommandeData;
  permissions: Permission[];
}

/** Icon by file type (PDF vs image) */
function FileIcon({ mimeOrName }: { mimeOrName: string }) {
  const isPdf =
    mimeOrName.includes("pdf") || mimeOrName.toLowerCase().endsWith(".pdf");
  if (isPdf) return <FileText className="h-5 w-5 text-destructive" />;
  return <ImageIcon className="h-5 w-5 text-primary" />;
}

/** Guess type from filename */
function guessTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "";
}

export function CommandeDetailClient({ commande: initialCommande, permissions }: Props) {
  const t = useTranslations("stock");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const stockService = useStockService();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [commande, setCommande] = useState(initialCommande);
  const [recevoirOpen, setRecevoirOpen] = useState(false);
  const [deleteFactureOpen, setDeleteFactureOpen] = useState(false);
  const [uploadFactureOpen, setUploadFactureOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const statut = commande.statut as StatutCommande;
  const canManage = permissions.includes(Permission.APPROVISIONNEMENT_GERER);

  const uniteLabel = (u: string) => t(`unites.${u}` as Parameters<typeof t>[0]) || u;
  const statutLabel = (s: string) => t(`statuts.${s}` as Parameters<typeof t>[0]) || s;

  // Order actions (send, cancel)
  function invalidateCommandes() {
    queryClient.invalidateQueries({ queryKey: queryKeys.stock.commandes() });
    queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
  }

  async function handleAction(action: string) {
    if (action === "envoyer") {
      const result = await stockService.envoyerCommande(commande.id);
      if (result.ok) invalidateCommandes();
    } else if (action === "annuler") {
      const result = await stockService.annulerCommande(commande.id);
      if (result.ok) invalidateCommandes();
    }
  }

  // Upload invoice separately (already LIVREE)
  async function handleUploadFacture() {
    if (!selectedFile) return;
    const result = await stockService.uploadFactureCommande(commande.id, selectedFile);
    if (result.ok) {
      setUploadFactureOpen(false);
      setSelectedFile(null);
      setCommande((prev) => ({
        ...prev,
        factureUrl: `factures/${commande.id}/uploaded`,
      }));
      invalidateCommandes();
    }
  }

  // View invoice (opens signed URL in new tab)
  async function handleVoirFacture() {
    const result = await stockService.getFactureCommandeUrl(commande.id);
    if (result.ok && result.data) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    }
  }

  // Delete invoice
  async function handleDeleteFacture() {
    const result = await stockService.deleteFactureCommande(commande.id);
    if (result.ok) {
      setDeleteFactureOpen(false);
      setCommande((prev) => ({ ...prev, factureUrl: null }));
      invalidateCommandes();
    }
  }

  // Client-side file validation (quick UX before submit)
  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setter(null);
      return;
    }

    const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
    const MAX = 10 * 1024 * 1024;

    if (!ALLOWED.includes(file.type)) {
      toast({
        title: t("commandes.formatNonAutorise"),
        variant: "error",
      });
      e.target.value = "";
      setter(null);
      return;
    }

    if (file.size > MAX) {
      toast({
        title: t("commandes.fichierTropVolumineux", {
          taille: (file.size / (1024 * 1024)).toFixed(1),
        }),
        variant: "error",
      });
      e.target.value = "";
      setter(null);
      return;
    }

    setter(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock/commandes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("commandes.title")}
      </Link>

      {/* Header info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{commande.numero}</h2>
            <Badge variant={statutVariants[statut]}>
              {statutLabel(statut)}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4 shrink-0" />
              <span>{commande.fournisseur.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {t("commandes.detail.commande", {
                  date: new Date(commande.dateCommande).toLocaleDateString("fr-FR"),
                })}
              </span>
            </div>
            {commande.dateLivraison && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <PackageCheck className="h-4 w-4 shrink-0" />
                <span>
                  {t("commandes.detail.livraison", {
                    date: new Date(commande.dateLivraison).toLocaleDateString("fr-FR"),
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">
              {formatNumber(commande.montantTotal)} FCFA
            </p>
            <p className="text-xs text-muted-foreground">{t("commandes.fields.montantTotal")}</p>
          </div>
          {commande.montantRecu !== null && commande.montantRecu !== commande.montantTotal && (
            <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Package className="h-3.5 w-3.5 text-warning" />
                <p className="text-xs font-medium text-warning">
                  {t("commandes.detail.reception.montantReel")}
                </p>
              </div>
              <p className="text-lg font-bold">
                {formatNumber(commande.montantRecu)} FCFA
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share actions */}
      <ShareCommandeButton
        commande={{
          numero: commande.numero,
          dateCommande: commande.dateCommande,
          fournisseur: commande.fournisseur,
          lignes: commande.lignes.map((l) => ({
            produit: {
              nom: l.produit.nom,
              unite: l.produit.unite,
              uniteAchat: l.produit.uniteAchat,
            },
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          })),
          montantTotal: commande.montantTotal,
        }}
      />

      {/* Order actions */}
      {canManage && (statut === StatutCommande.BROUILLON || statut === StatutCommande.ENVOYEE) && (
        <div className="flex gap-2">
          {statut === StatutCommande.BROUILLON && (
            <Button
              className="flex-1"
              onClick={() => handleAction("envoyer")}
            >
              <Send className="h-4 w-4 mr-1" />
              {t("commandes.detail.envoyer")}
            </Button>
          )}
          {statut === StatutCommande.ENVOYEE && (
            <>
              <Button
                className="flex-1"
                onClick={() => setRecevoirOpen(true)}
              >
                <PackageCheck className="h-4 w-4 mr-1" />
                {t("commandes.detail.receptionner")}
              </Button>

              {/* Reception dialog with line-level quantities */}
              <ReceptionCommandeDialog
                commande={commande}
                open={recevoirOpen}
                onOpenChange={setRecevoirOpen}
                onSuccess={() => {
                  invalidateCommandes();
                }}
              />
            </>
          )}
          <Button
            variant="danger"
            onClick={() => handleAction("annuler")}
          >
            <X className="h-4 w-4 mr-1" />
            {t("commandes.detail.annuler")}
          </Button>
        </div>
      )}

      {/* Supplier invoice section */}
      {canManage && statut === StatutCommande.LIVREE && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("commandes.detail.factureFournisseur")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {commande.factureUrl ? (
              /* Existing invoice: show with View + Delete buttons */
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <FileIcon mimeOrName={commande.factureUrl} />
                  <p className="text-sm text-muted-foreground flex-1 truncate">
                    {t("commandes.detail.factureAttachee")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleVoirFacture}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {t("commandes.detail.voirFacture")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeleteFactureOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* No invoice: show Add button */
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("commandes.detail.aucuneFacture")}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setUploadFactureOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t("commandes.detail.ajouterFacture")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload invoice dialog */}
      <Dialog open={uploadFactureOpen} onOpenChange={setUploadFactureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("commandes.detail.uploadFacture")}</DialogTitle>
            <DialogDescription>
              {t("commandes.detail.uploadDescription")}
            </DialogDescription>
          </DialogHeader>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFileChange(e, setSelectedFile)}
            />
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {selectedFile
                ? t("commandes.detail.changerFichier")
                : t("commandes.detail.choisirFichier")}
            </Button>
            {selectedFile && (
              <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-muted/50">
                <FileIcon mimeOrName={guessTypeFromName(selectedFile.name)} />
                <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} Mo
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                {t("commandes.detail.annuler")}
              </Button>
            </DialogClose>
            <Button
              onClick={handleUploadFacture}
              disabled={!selectedFile}
            >
              {t("commandes.detail.uploader")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete invoice confirmation dialog */}
      <Dialog open={deleteFactureOpen} onOpenChange={setDeleteFactureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("commandes.detail.supprimerFacture")}</DialogTitle>
            <DialogDescription>
              {t("commandes.detail.supprimerConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("commandes.detail.annuler")}</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={handleDeleteFacture}
            >
              {t("commandes.detail.supprimerFacture")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {t("commandes.detail.lignes", { count: commande.lignes.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {commande.lignes.map((ligne) => {
              const hasAchat = ligne.produit.uniteAchat;
              const displayUnite = hasAchat
                ? uniteLabel(ligne.produit.uniteAchat!)
                : uniteLabel(ligne.produit.unite);
              const sousTotal = ligne.quantite * ligne.prixUnitaire;
              // When receptionned, show quantiteRecue if it differs from quantite
              const qrecue = ligne.quantiteRecue;
              const hasEcart = qrecue !== null && qrecue !== ligne.quantite;
              return (
                <div key={ligne.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {ligne.produit.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ligne.quantite} {displayUnite} x {formatNumber(ligne.prixUnitaire)} FCFA
                    </p>
                    {hasEcart && (
                      <p className="text-xs text-warning mt-0.5">
                        {t("commandes.detail.reception.recu")} : {qrecue} {displayUnite}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold shrink-0 ml-2">
                    {formatNumber(sousTotal)} FCFA
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {t("commandes.detail.creePar", { name: commande.user.name })}
      </p>
    </div>
  );
}
