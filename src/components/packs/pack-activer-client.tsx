"use client";

import { useState } from "react";
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
            <h2 className="text-xl font-bold">Pack active avec succes !</h2>
            <p className="text-muted-foreground text-sm">Code d'activation : <span className="font-mono font-semibold">{result.activation.code}</span></p>
          </div>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Recapitulatif du provisioning</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-0 text-sm divide-y divide-border">
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">Site client cree</dt>
                <dd className="font-medium">{result.site.name}</dd>
              </div>
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">Pisciculteur cree</dt>
                <dd className="font-medium">{result.user.name} — {result.user.phone}</dd>
              </div>
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">Vague initialisee</dt>
                <dd className="font-medium font-mono">{result.vague.code}</dd>
                <dd className="text-xs text-muted-foreground">{result.vague.nombreInitial.toLocaleString()} alevins</dd>
              </div>
              <div className="py-3">
                <dt className="text-muted-foreground text-xs">Stock initialise</dt>
                <dd className="font-medium">{result.nombreProduitsInitialises} produit{result.nombreProduitsInitialises !== 1 ? "s" : ""} — {result.nombreMouvements} mouvement{result.nombreMouvements !== 1 ? "s" : ""} ENTREE</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/packs">Retour aux packs</Link>
          </Button>
          <Button asChild>
            <Link href="/activations">Voir toutes les activations</Link>
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
            Retour
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
                {pack.nombreAlevins.toLocaleString()} alevins — {pack.poidsMoyenInitial}g — {pack.prixTotal.toLocaleString()} FCFA
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
          <CardTitle className="text-base">1. Site du pisciculteur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom du site *</label>
            <Input
              value={clientSiteName}
              onChange={(e) => setClientSiteName(e.target.value)}
              placeholder="Ex: Ferme Ngozi — Bafia"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Adresse (optionnel)</label>
            <Input
              value={clientSiteAddress}
              onChange={(e) => setClientSiteAddress(e.target.value)}
              placeholder="Ex: Quartier Lac, Bafia, Mbam"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client user */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">2. Compte pisciculteur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom complet *</label>
            <Input
              value={clientUserName}
              onChange={(e) => setClientUserName(e.target.value)}
              placeholder="Ex: Jean-Marie Ngozi"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Telephone *</label>
            <Input
              type="tel"
              value={clientUserPhone}
              onChange={(e) => setClientUserPhone(e.target.value)}
              placeholder="Ex: 699 000 000"
              className="mt-1"
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground mt-1">Le code pays (+237) sera ajoute automatiquement</p>
          </div>
          <div>
            <label className="text-sm font-medium">Email (optionnel)</label>
            <Input
              type="email"
              value={clientUserEmail}
              onChange={(e) => setClientUserEmail(e.target.value)}
              placeholder="Ex: ngozi@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Mot de passe *</label>
            <Input
              type="password"
              value={clientUserPassword}
              onChange={(e) => setClientUserPassword(e.target.value)}
              placeholder="Min. 6 caracteres"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Le pisciculteur utilisera ce mot de passe pour se connecter.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Optional settings */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">3. Options (optionnel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Date d'expiration</label>
            <Input
              type="date"
              value={dateExpiration}
              onChange={(e) => setDateExpiration(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Notes internes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur l'activation..."
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
        Activer le pack
      </Button>
    </div>
  );
}
