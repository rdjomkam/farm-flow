"use client";

import { useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PackageCheck, Upload, X, FileText, ImageIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/format";
import { useStockService } from "@/services";
import type { LigneReceptionInput } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LigneProduit {
  nom: string;
  unite: string;
  uniteAchat: string | null;
  contenance: number | null;
}

interface LigneData {
  id: string;
  quantite: number;
  prixUnitaire: number;
  produit: LigneProduit;
}

interface CommandeData {
  id: string;
  numero: string;
  lignes: LigneData[];
}

interface LigneReceptionState {
  ligneId: string;
  produit: { nom: string; unite: string; uniteAchat: string | null };
  quantiteCommandee: number;
  prixUnitaire: number;
  quantiteRecue: string; // string for controlled input
}

interface Props {
  commande: CommandeData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FileIcon({ mimeOrName }: { mimeOrName: string }) {
  const isPdf =
    mimeOrName.includes("pdf") || mimeOrName.toLowerCase().endsWith(".pdf");
  if (isPdf) return <FileText className="h-5 w-5 text-destructive" />;
  return <ImageIcon className="h-5 w-5 text-primary" />;
}

/** Returns the display unit for a ligne (achat unit or stock unit) */
function displayUnite(ligne: LigneData, t: ReturnType<typeof useTranslations<"stock">>) {
  const u = ligne.produit.uniteAchat ?? ligne.produit.unite;
  return t(`unites.${u}` as Parameters<typeof t>[0]) || u;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReceptionCommandeDialog({
  commande,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const t = useTranslations("stock");
  const { toast } = useToast();
  const stockService = useStockService();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dateLivraison, setDateLivraison] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize lignes state: pre-fill quantiteRecue with quantite commandee
  const [lignesState, setLignesState] = useState<LigneReceptionState[]>(() =>
    commande.lignes.map((ligne) => ({
      ligneId: ligne.id,
      produit: {
        nom: ligne.produit.nom,
        unite: ligne.produit.unite,
        uniteAchat: ligne.produit.uniteAchat,
      },
      quantiteCommandee: ligne.quantite,
      prixUnitaire: ligne.prixUnitaire,
      quantiteRecue: String(ligne.quantite),
    }))
  );

  // Live-compute montant reel
  const montantReel = useMemo(() => {
    return lignesState.reduce((sum, ligne) => {
      const qr = parseFloat(ligne.quantiteRecue);
      if (!isNaN(qr) && qr >= 0) {
        return sum + qr * ligne.prixUnitaire;
      }
      return sum;
    }, 0);
  }, [lignesState]);

  // Form validity: all inputs must be valid numbers >= 0
  const isValid = useMemo(() => {
    return lignesState.every((l) => {
      const v = parseFloat(l.quantiteRecue);
      return !isNaN(v) && v >= 0 && l.quantiteRecue.trim() !== "";
    });
  }, [lignesState]);

  // Update a single ligne quantiteRecue
  function handleLigneChange(ligneId: string, value: string) {
    setLignesState((prev) =>
      prev.map((l) => (l.ligneId === ligneId ? { ...l, quantiteRecue: value } : l))
    );
  }

  // File validation and selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
    const MAX = 10 * 1024 * 1024;

    if (!ALLOWED.includes(file.type)) {
      toast({ title: t("commandes.formatNonAutorise"), variant: "error" });
      e.target.value = "";
      setSelectedFile(null);
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
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  // Submit reception
  async function handleSubmit() {
    if (!isValid) return;

    const lignes: LigneReceptionInput[] = lignesState.map((l) => ({
      ligneId: l.ligneId,
      quantiteRecue: parseFloat(l.quantiteRecue),
    }));

    setSubmitting(true);
    try {
      const result = await stockService.recevoirCommande(
        commande.id,
        dateLivraison,
        lignes,
        selectedFile ?? undefined
      );

      if (result.ok) {
        // Show warnings if any
        if (result.data?.avertissements && result.data.avertissements.length > 0) {
          for (const avert of result.data.avertissements) {
            toast({ title: avert, variant: "info" });
          }
        }
        onOpenChange(false);
        setSelectedFile(null);
        onSuccess?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Reset state when dialog closes
  function handleOpenChange(value: boolean) {
    if (!value) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Reset lignes to initial (commandee) values
      setLignesState(
        commande.lignes.map((ligne) => ({
          ligneId: ligne.id,
          produit: {
            nom: ligne.produit.nom,
            unite: ligne.produit.unite,
            uniteAchat: ligne.produit.uniteAchat,
          },
          quantiteCommandee: ligne.quantite,
          prixUnitaire: ligne.prixUnitaire,
          quantiteRecue: String(ligne.quantite),
        }))
      );
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("commandes.detail.reception.title", { numero: commande.numero })}
          </DialogTitle>
          <DialogDescription>
            {t("commandes.detail.reception.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {/* Date de livraison */}
          <Input
            label={t("commandes.detail.dateLivraison")}
            type="date"
            value={dateLivraison}
            onChange={(e) => setDateLivraison(e.target.value)}
          />

          {/* Quantites recues par ligne */}
          <div>
            <p className="text-sm font-medium mb-2">
              {t("commandes.detail.reception.quantitesRecues")}
            </p>
            <div className="flex flex-col gap-3">
              {lignesState.map((ligne, idx) => {
                const qr = parseFloat(ligne.quantiteRecue);
                const isValidValue = !isNaN(qr) && qr >= 0;
                const unite = displayUnite(commande.lignes[idx], t);

                // Determine badge
                let badge: "complet" | "partiel" | "zero" | "surlivraison" | null = null;
                if (isValidValue) {
                  if (qr === 0) badge = "zero";
                  else if (qr > ligne.quantiteCommandee) badge = "surlivraison";
                  else if (qr < ligne.quantiteCommandee) badge = "partiel";
                  else badge = "complet";
                }

                const badgeVariantMap = {
                  complet: "en_cours" as const,
                  partiel: "warning" as const,
                  zero: "default" as const,
                  surlivraison: "info" as const,
                };

                return (
                  <div
                    key={ligne.ligneId}
                    className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{ligne.produit.nom}</p>
                      {badge && (
                        <Badge variant={badgeVariantMap[badge]} className="shrink-0 text-xs">
                          {t(`commandes.detail.reception.badge${badge.charAt(0).toUpperCase() + badge.slice(1)}` as Parameters<typeof t>[0])}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("commandes.detail.reception.commande")}
                      {" : "}
                      {ligne.quantiteCommandee} {unite}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t("commandes.detail.reception.recu")} :
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={ligne.quantiteRecue}
                        onChange={(e) => handleLigneChange(ligne.ligneId, e.target.value)}
                        className={!isValidValue ? "border-destructive" : ""}
                        aria-label={`${t("commandes.detail.reception.recu")} — ${ligne.produit.nom}`}
                      />
                      <span className="text-xs text-muted-foreground shrink-0">{unite}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Facture fournisseur optionnelle */}
          <div>
            <p className="text-sm font-medium mb-1">
              {t("commandes.detail.factureOptionnelle")}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              {t("commandes.detail.factureFormat")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
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
              <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50">
                <FileIcon mimeOrName={selectedFile.name} />
                <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                <button
                  type="button"
                  aria-label="Supprimer le fichier"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive"
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

          {/* Montant reel calcule en live */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("commandes.detail.reception.montantReel")}
              </p>
              <p className="text-lg font-bold">
                {t("commandes.detail.reception.montantValue", {
                  montant: formatNumber(montantReel),
                })}
              </p>
            </div>
          </div>

          {/* Avertissements (surlivraisons visibles avant soumission) */}
          {lignesState.some((l) => {
            const qr = parseFloat(l.quantiteRecue);
            return !isNaN(qr) && qr > l.quantiteCommandee;
          }) && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-warning">
                  {t("commandes.detail.reception.avertissements")}
                </p>
                {lignesState
                  .filter((l) => {
                    const qr = parseFloat(l.quantiteRecue);
                    return !isNaN(qr) && qr > l.quantiteCommandee;
                  })
                  .map((l) => (
                    <p key={l.ligneId} className="text-xs text-muted-foreground">
                      {l.produit.nom} : {l.quantiteRecue} &gt; {l.quantiteCommandee}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>
              {t("commandes.detail.annuler")}
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            <PackageCheck className="h-4 w-4 mr-2" />
            {t("commandes.detail.confirmerReception")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
