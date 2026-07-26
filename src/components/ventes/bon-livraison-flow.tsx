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
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { Textarea } from "@/components/ui/textarea";
import { useVenteService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import { formatNumber } from "@/lib/format";
import { shareBonLivraisonPDF } from "@/lib/share-bon-livraison";
import { useToast } from "@/components/ui/toast";
import { StatutBonLivraison } from "@/types";
import type {
  BonLivraisonDetailResponse,
  EnregistrerQuantiteLigneBonLivraisonDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowStep =
  | "loading"
  | "error"
  | "quantites"
  | "recap"
  | "signature-client"
  | "signature-livreur"
  | "signed";

/** Etat local de saisie des quantites livrees pour une ligne de vente */
interface QuantiteLigneState {
  poidsLivreKg: string;
  nombreMortsTransport: string;
  motifAvarie: string;
}

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
 * Etapes (Sprint BF — fusion quantites/signature) :
 * 1. Quantites livrees par ligne (poids livre, morts transport, motif) —
 *    ex-dialog "Confirmer la livraison" de vente-detail-client.tsx, desormais
 *    integre ici, avant signature. Persiste sur le BL (BROUILLON -> EN_ATTENTE_SIGNATURE),
 *    modifiable tant que non signe.
 * 2. Recap : quantites REELLEMENT livrees (LigneBonLivraison) + ecarts vs
 *    commande + bloc paiement recalcule sur le livre — plus jamais le poids commande.
 * 3. Signature client (canvas + nom du signataire)
 * 4. Signature livreur (canvas)
 * 5. Confirmation (telecharger PDF / partager) — la signature applique les
 *    quantites, passe le BL en SIGNE et la vente en LIVREE (une seule transaction).
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
  // Etape quantites — reutilise le namespace i18n de l'ex-dialog "Confirmer
  // la livraison" (Sprint AV), desormais integre a l'etape 1 du flux BL
  const tQuantites = useTranslations("ventes.livraisonAvarie");
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
  // Signature client capturee AVANT le demontage du pad (le pad n'est monte
  // que pendant l'etape signature-client ; a l'etape livreur clientPadRef est null)
  const [clientSignatureData, setClientSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Etape quantites (Sprint BF — ex-dialog "Confirmer la livraison")
  const [dateLivraison, setDateLivraison] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [quantitesLignes, setQuantitesLignes] = useState<
    Record<string, QuantiteLigneState>
  >({});
  const [quantitesSubmitting, setQuantitesSubmitting] = useState(false);

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
      setClientSignatureData(null);
      setDateLivraison(new Date().toISOString().slice(0, 10));
      setQuantitesLignes({});
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
      return;
    }

    // Pre-remplit la saisie des quantites depuis les lignes du BL (deja
    // prereplies au poids commande cote backend) — modifiable tant que non signe
    const bl = result.data.bonLivraison;
    setDateLivraison(
      bl.dateLivraison
        ? new Date(bl.dateLivraison).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    const map: Record<string, QuantiteLigneState> = {};
    for (const ligne of result.data.vente.lignes ?? []) {
      const ligneBL = bl.lignes?.find((l) => l.ligneVenteId === ligne.id);
      map[ligne.id] = {
        poidsLivreKg: String(ligneBL?.poidsLivreKg ?? ligne.poidsTotalKg),
        nombreMortsTransport: String(ligneBL?.nombreMortsTransport ?? 0),
        motifAvarie: ligneBL?.motifAvarie ?? "",
      };
    }
    setQuantitesLignes(map);
    setStep("quantites");
  }

  function updateQuantiteLigne(ligneId: string, patch: Partial<QuantiteLigneState>) {
    setQuantitesLignes((prev) => ({
      ...prev,
      [ligneId]: { ...prev[ligneId], ...patch },
    }));
  }

  async function handleSubmitQuantites() {
    if (!data?.bonLivraison) return;
    setQuantitesSubmitting(true);
    try {
      const lignesDTO: EnregistrerQuantiteLigneBonLivraisonDTO[] = (
        data.vente.lignes ?? []
      ).map((ligne) => {
        const state = quantitesLignes[ligne.id];
        const motif = state?.motifAvarie?.trim();
        return {
          ligneVenteId: ligne.id,
          poidsLivreKg: parseFloat(state?.poidsLivreKg ?? String(ligne.poidsTotalKg)),
          nombreMortsTransport: parseInt(state?.nombreMortsTransport ?? "0", 10) || 0,
          ...(motif ? { motifAvarie: motif } : {}),
        };
      });

      const result = await venteService.enregistrerQuantitesBonLivraison(
        data.bonLivraison.id,
        { dateLivraison, lignes: lignesDTO }
      );
      if (result.ok) {
        const refreshed = await venteService.getBonLivraison(venteId);
        if (refreshed.ok && refreshed.data) {
          setData(refreshed.data);
        }
        setStep("recap");
      } else {
        toast({
          title: result.error ?? t("errors.quantitesSaveFailed"),
          variant: "error",
        });
      }
    } finally {
      setQuantitesSubmitting(false);
    }
  }

  async function handleValidateSignature() {
    if (!data) return;
    const signatureClient = clientSignatureData;
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
      } else {
        toast({
          title: result.error ?? t("errors.signatureFailed"),
          variant: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const lignes = data?.vente.lignes ?? [];
  const bonLivraison = data?.bonLivraison;
  const blocPaiement = data?.blocPaiement;

  // -- Etape quantites : validation + totaux derives --
  let quantitesTotalLivreKg = 0;
  let quantitesTotalMortsTransport = 0;
  let quantitesTotalPoissonsLivres = 0;
  let quantitesValid = lignes.length > 0;
  for (const ligne of lignes) {
    const state = quantitesLignes[ligne.id];
    const poidsLivreNum = state ? parseFloat(state.poidsLivreKg) : NaN;
    const mortsNum = state ? parseInt(state.nombreMortsTransport || "0", 10) : NaN;
    if (
      state === undefined ||
      isNaN(poidsLivreNum) ||
      poidsLivreNum < 0 ||
      isNaN(mortsNum) ||
      mortsNum < 0 ||
      mortsNum > ligne.nombrePoissons
    ) {
      quantitesValid = false;
    }
    const safePoidsLivre = isNaN(poidsLivreNum) ? 0 : poidsLivreNum;
    const safeMorts = isNaN(mortsNum) ? 0 : mortsNum;
    quantitesTotalLivreKg += safePoidsLivre;
    quantitesTotalMortsTransport += safeMorts;
    quantitesTotalPoissonsLivres += Math.max(0, ligne.nombrePoissons - safeMorts);
  }

  // -- Etape recap : quantites reellement livrees (LigneBonLivraison), pas
  // le poids commande (ligne.poidsTotalKg) — c'est la correction du bug BF.
  const lignesBLparLigneVente = new Map(
    (bonLivraison?.lignes ?? []).map((l) => [l.ligneVenteId, l])
  );
  let recapTotalLivreKg = 0;
  for (const ligne of lignes) {
    const ligneBL = lignesBLparLigneVente.get(ligne.id);
    recapTotalLivreKg += ligneBL?.poidsLivreKg ?? ligne.poidsTotalKg;
  }
  const prixUnitaireKg = data?.vente.prixUnitaireKg ?? 0;
  const recapMontantLivre = recapTotalLivreKg * prixUnitaireKg;
  const recapPaye = blocPaiement?.paye ?? 0;
  const recapResteAPayer = Math.max(0, recapMontantLivre - recapPaye);

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

          {/* Etape : quantites livrees (Sprint BF — ex-dialog "Confirmer la livraison") */}
          {step === "quantites" && bonLivraison && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t("quantites.instructions")}
              </p>

              <Input
                label={t("quantites.dateLivraisonLabel")}
                type="date"
                value={dateLivraison}
                onChange={(e) => setDateLivraison(e.target.value)}
              />

              {lignes.map((ligne) => {
                const state = quantitesLignes[ligne.id] ?? {
                  poidsLivreKg: String(ligne.poidsTotalKg),
                  nombreMortsTransport: "0",
                  motifAvarie: "",
                };
                const poidsLivreNum = parseFloat(state.poidsLivreKg) || 0;
                const pertePoids = ligne.poidsTotalKg - poidsLivreNum;

                return (
                  <div
                    key={ligne.id}
                    className="rounded-lg border border-border/50 p-3 flex flex-col gap-3"
                  >
                    <p className="font-medium text-sm">
                      {ligne.vague?.code ?? "-"}
                      {ligne.bac?.nom ? ` — ${ligne.bac.nom}` : ""}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {ligne.nombrePoissons} {t("recap.poissons")} /{" "}
                        {ligne.poidsTotalKg} kg
                      </span>
                    </p>

                    <Input
                      label={tQuantites("poidsLivreLabel")}
                      type="number"
                      step="0.1"
                      min="0"
                      value={state.poidsLivreKg}
                      onChange={(e) =>
                        updateQuantiteLigne(ligne.id, { poidsLivreKg: e.target.value })
                      }
                    />

                    <Input
                      label={tQuantites("mortsTransportLabel")}
                      type="number"
                      step="1"
                      min="0"
                      max={ligne.nombrePoissons}
                      value={state.nombreMortsTransport}
                      onChange={(e) =>
                        updateQuantiteLigne(ligne.id, {
                          nombreMortsTransport: e.target.value,
                        })
                      }
                    />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">
                        {tQuantites("motifLabel")}
                      </label>
                      <Textarea
                        value={state.motifAvarie}
                        onChange={(e) =>
                          updateQuantiteLigne(ligne.id, { motifAvarie: e.target.value })
                        }
                        placeholder={tQuantites("motifPlaceholder")}
                        rows={2}
                      />
                    </div>

                    {pertePoids > 0 && (
                      <p className="text-xs text-warning flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {tQuantites("pertePoidsLabel", { kg: pertePoids.toFixed(1) })}
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {tQuantites("totalLivreLabel", {
                      kgLivre: quantitesTotalLivreKg.toFixed(1),
                      kgCommande: (data?.vente.poidsTotalKg ?? 0).toFixed(1),
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className={
                      quantitesTotalMortsTransport > 0
                        ? "text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    {tQuantites("totalMortsLabel", { nb: quantitesTotalMortsTransport })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {tQuantites("totalPoissonsLivreLabel", {
                      nb: quantitesTotalPoissonsLivres,
                    })}
                  </span>
                </div>
              </div>
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
                    {lignes.map((ligne) => {
                      const ligneBL = lignesBLparLigneVente.get(ligne.id);
                      const poidsLivre = ligneBL?.poidsLivreKg ?? ligne.poidsTotalKg;
                      const ecart = ligne.poidsTotalKg - poidsLivre;
                      // Nombre de poissons reellement livres — meme source de
                      // verite que le PDF (route export/bon-livraison) : le
                      // snapshot fige LigneBonLivraison.nombrePoissonsLivres en
                      // priorite, sinon la meme formule que signerBonLivraison
                      // appliquera a la signature (commande - morts transport).
                      // Avant cette correction, le recap affichait encore
                      // ligne.nombrePoissons (valeur commandee brute), ce qui
                      // divergeait du PDF signe (ex. 90 a l'ecran vs 87 sur le PDF).
                      const poissonsLivres =
                        ligneBL?.nombrePoissonsLivres ??
                        ligne.nombrePoissons - (ligneBL?.nombreMortsTransport ?? 0);
                      return (
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
                              {poissonsLivres} {t("recap.poissons")}
                            </span>
                            {Math.abs(ecart) > 0.01 && (
                              <span className="text-xs text-warning">
                                {t("recap.ecartLabel", {
                                  kgCommande: ligne.poidsTotalKg,
                                  kg: ecart.toFixed(1),
                                })}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold">{poidsLivre} kg</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-3 flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("recap.totalVente")}</span>
                    <span className="font-medium">
                      {formatNumber(recapMontantLivre)} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("recap.paye")}</span>
                    <span className="font-medium text-success">
                      {formatNumber(recapPaye)} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5">
                    <span className="font-semibold">{t("recap.resteAPayer")}</span>
                    <span className="font-bold text-warning">
                      {formatNumber(recapResteAPayer)} FCFA
                    </span>
                  </div>
                </CardContent>
              </Card>
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
                    className="w-full h-32 object-contain"
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
                    className="w-full h-32 object-contain"
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
          {step === "quantites" && (
            <Button
              onClick={handleSubmitQuantites}
              disabled={!quantitesValid || quantitesSubmitting}
              className="min-h-[44px]"
            >
              {quantitesSubmitting ? t("validating") : t("next")}
            </Button>
          )}

          {step === "recap" && (
            <Button
              onClick={() => {
                // Pre-remplir le nom du signataire avec le nom du client
                // (modifiable), sans ecraser une saisie deja effectuee
                setSignataireClientNom((prev) => prev || data?.vente.client.nom || "");
                setStep("signature-client");
              }}
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
                onClick={() => {
                  // Capturer la signature avant le demontage du pad
                  setClientSignatureData(clientPadRef.current?.toDataURL() ?? null);
                  setStep("signature-livreur");
                }}
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
                onClick={() => {
                  // Le pad client remonte vide : reinitialiser l'etat capture
                  setClientSignatureData(null);
                  setClientSignatureEmpty(true);
                  setStep("signature-client");
                }}
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
