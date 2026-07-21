"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, FileDown, Share2, User, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { SignaturePad, type SignaturePadHandle } from "@/components/ventes/signature-pad";
import { useVenteService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import { formatNumber } from "@/lib/format";
import { shareBonLivraisonPDF } from "@/lib/share-bon-livraison";
import { useToast } from "@/components/ui/toast";
import { StatutBonLivraison } from "@/types";
import type { BonLivraisonDetailResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowStep =
  | "loading"
  | "error"
  | "recap"
  | "signature-client"
  | "signature-livreur"
  | "signed";

interface BonLivraisonFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venteId: string;
  /** Nom de l'utilisateur courant — affiche comme livreur */
  currentUserName: string;
  /** Appele apres une signature reussie (permet au parent de rafraichir la vente) */
  onSigned?: () => void;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * BonLivraisonFlow — flux mobile multi-etapes pour creer/consulter/signer un
 * bon de livraison.
 *
 * Etapes :
 * 1. Recap (numero, lignes livrees, bloc paiement)
 * 2. Signature client (canvas + nom du signataire)
 * 3. Signature livreur (canvas)
 * 4. Confirmation (telecharger PDF / partager — placeholders BL.5/BL.6)
 *
 * Si le BL est deja SIGNE a l'ouverture (consultation en lecture seule
 * depuis une vente LIVREE/CLOTUREE), le flux saute directement a l'etape
 * finale avec les signatures affichees en lecture seule.
 */
export function BonLivraisonFlow({
  open,
  onOpenChange,
  venteId,
  currentUserName,
  onSigned,
}: BonLivraisonFlowProps) {
  const t = useTranslations("ventes.bonLivraison");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const venteService = useVenteService();
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>("loading");
  const [data, setData] = useState<BonLivraisonDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [signataireClientNom, setSignataireClientNom] = useState("");
  const [clientSignatureEmpty, setClientSignatureEmpty] = useState(true);
  const [livreurSignatureEmpty, setLivreurSignatureEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const clientPadRef = useRef<SignaturePadHandle>(null);
  const livreurPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (open) {
      void loadBonLivraison();
    } else {
      // Reset a la fermeture pour repartir propre a la prochaine ouverture
      setStep("loading");
      setData(null);
      setErrorMessage("");
      setSignataireClientNom("");
      setClientSignatureEmpty(true);
      setLivreurSignatureEmpty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, venteId]);

  async function loadBonLivraison() {
    setStep("loading");
    let result = await venteService.getBonLivraison(venteId);

    if (!result.ok) {
      // Pas encore de BL pour cette vente -> le creer (idempotent), puis relire
      const created = await venteService.createBonLivraison(venteId);
      if (!created.ok) {
        setErrorMessage(created.error ?? t("errors.creationFailed"));
        setStep("error");
        return;
      }
      result = await venteService.getBonLivraison(venteId);
    }

    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? t("errors.loadFailed"));
      setStep("error");
      return;
    }

    setData(result.data);
    if (result.data.bonLivraison.statut === StatutBonLivraison.SIGNE) {
      setStep("signed");
    } else {
      setStep("recap");
    }
  }

  async function handleValidateSignature() {
    if (!data) return;
    const signatureClient = clientPadRef.current?.toDataURL();
    const signatureLivreur = livreurPadRef.current?.toDataURL();
    if (!signatureClient || !signatureLivreur || !signataireClientNom.trim()) return;

    setSubmitting(true);
    try {
      const result = await venteService.signerBonLivraison(data.bonLivraison.id, {
        signatureClient,
        signataireClientNom: signataireClientNom.trim(),
        signatureLivreur,
      });
      if (result.ok && result.data) {
        setData((prev) =>
          prev
            ? { ...prev, bonLivraison: { ...prev.bonLivraison, ...result.data } }
            : prev
        );
        setStep("signed");
        queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
        router.refresh();
        onSigned?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const lignes = data?.vente.lignes ?? [];
  const bonLivraison = data?.bonLivraison;
  const blocPaiement = data?.blocPaiement;

  async function handleShare() {
    if (!data || !bonLivraison || !blocPaiement) return;
    setSharing(true);
    try {
      const result = await shareBonLivraisonPDF(bonLivraison.id, bonLivraison.numero, {
        numero: bonLivraison.numero,
        date: bonLivraison.createdAt,
        client: { nom: data.vente.client.nom },
        nombreLignes: lignes.length,
        montantTotal: blocPaiement.totalVente,
        resteAPayer: blocPaiement.resteAPayer,
      });
      if (!result.ok) {
        toast({ title: result.error ?? t("signed.shareError"), variant: "error" });
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 shrink-0" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("title")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Etape : chargement */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">{t("loading")}</p>
            </div>
          )}

          {/* Etape : erreur */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Etape : recap */}
          {step === "recap" && bonLivraison && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-base">{bonLivraison.numero}</p>
                <p className="text-xs text-muted-foreground">
                  {t("recap.client")} : {data?.vente.client.nom}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("recap.date")} :{" "}
                  {new Date(bonLivraison.createdAt).toLocaleDateString(locale)}
                </p>
              </div>

              {lignes.length > 0 && (
                <Card>
                  <CardContent className="p-3 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("recap.lignesTitle")}
                    </p>
                    {lignes.map((ligne) => (
                      <div
                        key={ligne.id}
                        className="rounded-lg bg-muted/30 p-2.5 flex items-center justify-between text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {ligne.vague?.code ?? "-"}
                            {ligne.bac?.nom ? ` — ${ligne.bac.nom}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ligne.nombrePoissons} {t("recap.poissons")}
                          </span>
                        </div>
                        <span className="font-semibold">{ligne.poidsTotalKg} kg</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {blocPaiement && (
                <Card>
                  <CardContent className="p-3 flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("recap.totalVente")}</span>
                      <span className="font-medium">
                        {formatNumber(blocPaiement.totalVente)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("recap.paye")}</span>
                      <span className="font-medium text-success">
                        {formatNumber(blocPaiement.paye)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border/50 pt-1.5">
                      <span className="font-semibold">{t("recap.resteAPayer")}</span>
                      <span className="font-bold text-warning">
                        {formatNumber(blocPaiement.resteAPayer)} FCFA
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Etape : signature client */}
          {step === "signature-client" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("signatureClient.instructions")}</p>
              <Input
                label={t("signatureClient.nomLabel")}
                value={signataireClientNom}
                onChange={(e) => setSignataireClientNom(e.target.value)}
                placeholder={t("signatureClient.nomPlaceholder")}
              />
              <SignaturePad ref={clientPadRef} onChangeEmpty={setClientSignatureEmpty} />
            </div>
          )}

          {/* Etape : signature livreur */}
          {step === "signature-livreur" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("signatureLivreur.instructions")}</p>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{currentUserName}</span>
              </div>
              <SignaturePad ref={livreurPadRef} onChangeEmpty={setLivreurSignatureEmpty} />
            </div>
          )}

          {/* Etape : signe / lecture seule */}
          {step === "signed" && bonLivraison && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <p className="text-sm font-semibold text-success">{t("signed.title")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("signed.numero", { numero: bonLivraison.numero })}
                </p>
              </div>

              {bonLivraison.signatureClient && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("signed.signatureClientLabel", {
                      nom: bonLivraison.signataireClientNom ?? "",
                    })}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bonLivraison.signatureClient}
                    alt={t("signed.signatureClientAlt")}
                    className="w-full h-32 object-contain rounded-lg border border-border bg-[var(--background)]"
                  />
                </div>
              )}

              {bonLivraison.signatureLivreur && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("signed.signatureLivreurLabel")}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bonLivraison.signatureLivreur}
                    alt={t("signed.signatureLivreurAlt")}
                    className="w-full h-32 object-contain rounded-lg border border-border bg-[var(--background)]"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button asChild variant="outline">
                  <a
                    href={`/api/export/bon-livraison/${bonLivraison.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown className="h-4 w-4" />
                    {t("signed.downloadPdf")}
                  </a>
                </Button>
                <Button variant="outline" onClick={handleShare} disabled={sharing}>
                  {sharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  {sharing ? t("signed.partageEnCours") : t("signed.share")}
                </Button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === "recap" && (
            <Button
              onClick={() => setStep("signature-client")}
              className="min-h-[44px]"
              disabled={!bonLivraison}
            >
              {t("recap.fairesigner")}
            </Button>
          )}

          {step === "signature-client" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("recap")}
                className="min-h-[44px]"
              >
                {t("back")}
              </Button>
              <Button
                onClick={() => setStep("signature-livreur")}
                disabled={clientSignatureEmpty || !signataireClientNom.trim()}
                className="min-h-[44px]"
              >
                {t("next")}
              </Button>
            </>
          )}

          {step === "signature-livreur" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("signature-client")}
                className="min-h-[44px]"
              >
                {t("back")}
              </Button>
              <Button
                onClick={handleValidateSignature}
                disabled={livreurSignatureEmpty || submitting}
                className="min-h-[44px]"
              >
                {submitting ? t("validating") : t("signatureLivreur.valider")}
              </Button>
            </>
          )}

          {step === "signed" && (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              {t("close")}
            </Button>
          )}

          {step === "error" && (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              {t("close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
