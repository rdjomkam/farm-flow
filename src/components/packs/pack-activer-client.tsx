"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfigService } from "@/services";

interface PackInfo {
  id: string;
  nom: string;
  nombreAlevins: number;
  poidsMoyenInitial: number;
  prixTotal: number;
  plan?: { id: string; nom: string };
  produits: Array<{ id: string; quantite: number; produit: { nom: string; unite: string } }>;
}

interface Props {
  pack: PackInfo;
}

interface ProvisioningResult {
  site: { id: string; name: string };
  user: { id: string; name: string; phone: string };
  vague: { id: string; code: string; nombreInitial: number };
  nombreProduitsInitialises: number;
  nombreMouvements: number;
  activation: { id: string; code: string; statut: string };
}

export function PackActiverClient({ pack }: Props) {
  const t = useTranslations("packs");
  const configService = useConfigService();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);
  const [result, setResult] = useState<ProvisioningResult | null>(null);

  // Form state
  const [clientSiteName, setClientSiteName] = useState("");
  const [clientSiteAddress, setClientSiteAddress] = useState("");
  const [clientUserName, setClientUserName] = useState("");
  const [clientUserPhone, setClientUserPhone] = useState("");
  const [clientUserEmail, setClientUserEmail] = useState("");
  const [clientUserPassword, setClientUserPassword] = useState("");
  const [dateExpiration, setDateExpiration] = useState("");
  const [notes, setNotes] = useState("");

  async function handleActivation() {
    if (!clientSiteName.trim() || !clientUserName.trim() || !clientUserPhone.trim() || !clientUserPassword || clientUserPassword.length < 6) return;

    const apiResult = await configService.activerPack(pack.id, {
      clientSiteName: clientSiteName.trim(),
      clientSiteAddress: clientSiteAddress.trim() || null,
      clientUserName: clientUserName.trim(),
      clientUserPhone: clientUserPhone.trim(),
      clientUserEmail: clientUserEmail.trim() || null,
      clientUserPassword,
      dateExpiration: dateExpiration || null,
      notes: notes.trim() || null,
    } as Parameters<typeof configService.activerPack>[1]);
    if (apiResult.ok && apiResult.data) {
      setResult(apiResult.data as unknown as ProvisioningResult);
      setStep(2);
    }
  }

  // Success screen
  if (step === 2 && result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-xl font-bold">{t("activer.successTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("activer.codeActivation")} <span className="font-mono font-semibold">{result.activation.code}</span></p>
          </div>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">{t("activer.recapTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-0 text-sm divide-y divide-border">
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">{t("activer.siteCree")}</dt>
                <dd className="font-medium">{result.site.name}</dd>
              </div>
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">{t("activer.pisciculteurCree")}</dt>
                <dd className="font-medium">{result.user.name} &mdash; {result.user.phone}</dd>
              </div>
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">{t("activer.vagueInitialisee")}</dt>
                <dd className="font-medium font-mono">{result.vague.code}</dd>
                <dd className="text-xs text-muted-foreground">{t("activer.vagueAlevins", { count: formatNumber(result.vague.nombreInitial) })}</dd>
              </div>
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">{t("activer.stockInitialise")}</dt>
                <dd className="font-medium">{t("activer.stockResume", { produits: result.nombreProduitsInitialises, mouvements: result.nombreMouvements })}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/packs">{t("activer.retourPacks")}</Link>
          </Button>
          <Button asChild>
            <Link href="/activations">{t("activer.voirActivations")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Activation form (step 1)
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/packs/${pack.id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("detail.retour")}
          </Link>
        </Button>
      </div>

      {/* Pack summary */}
      <Card className="shadow-none bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">{pack.nom}</p>
              <p className="text-sm text-muted-foreground">
                {formatNumber(pack.nombreAlevins)} alevins &mdash; {pack.poidsMoyenInitial}g &mdash; {formatNumber(pack.prixTotal)} FCFA
              </p>
              {pack.produits.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {pack.produits.length} produit{pack.produits.length !== 1 ? "s" : ""} inclus dans le stock
                </p>
              )}
              {pack.plan && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Plan : <span className="font-medium">{pack.plan.nom}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client site */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t("activer.siteTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t("activer.nomSiteLabel")} *</label>
            <Input
              value={clientSiteName}
              onChange={(e) => setClientSiteName(e.target.value)}
              placeholder={t("activer.nomSitePlaceholder")}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("activer.adresseLabel")}</label>
            <Input
              value={clientSiteAddress}
              onChange={(e) => setClientSiteAddress(e.target.value)}
              placeholder={t("activer.adressePlaceholder")}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client user */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t("activer.pisciculteurTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t("activer.nomCompletLabel")} *</label>
            <Input
              value={clientUserName}
              onChange={(e) => setClientUserName(e.target.value)}
              placeholder={t("activer.nomCompletPlaceholder")}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("activer.telephoneLabel")} *</label>
            <Input
              type="tel"
              value={clientUserPhone}
              onChange={(e) => setClientUserPhone(e.target.value)}
              placeholder={t("activer.telephonePlaceholder")}
              className="mt-1"
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground mt-1">{t("activer.telephoneHint")}</p>
          </div>
          <div>
            <label className="text-sm font-medium">{t("activer.emailLabel")}</label>
            <Input
              type="email"
              value={clientUserEmail}
              onChange={(e) => setClientUserEmail(e.target.value)}
              placeholder={t("activer.emailPlaceholder")}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("activer.motDePasseLabel")} *</label>
            <Input
              type="password"
              value={clientUserPassword}
              onChange={(e) => setClientUserPassword(e.target.value)}
              placeholder={t("activer.motDePasseMin")}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("activer.motDePasseHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Optional settings */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">{t("activer.optionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t("activer.dateExpiration")}</label>
            <Input
              type="date"
              value={dateExpiration}
              onChange={(e) => setDateExpiration(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("activer.notesLabel")}</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("activer.notesPlaceholder")}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleActivation}
      >
        {t("activer.submit")}
      </Button>
    </div>
  );
}
