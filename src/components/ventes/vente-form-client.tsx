"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

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
  clients: ClientOption[];
  vagues: VagueOption[];
}

export function VenteFormClient({ clients, vagues }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [clientId, setClientId] = useState("");
  const [vagueId, setVagueId] = useState("");
  const [quantitePoissons, setQuantitePoissons] = useState("");
  const [poidsTotalKg, setPoidsTotalKg] = useState("");
  const [prixUnitaireKg, setPrixUnitaireKg] = useState("");
  const [notes, setNotes] = useState("");

  const selectedVague = vagues.find((v) => v.id === vagueId);
  const montantTotal =
    (parseFloat(poidsTotalKg) || 0) * (parseFloat(prixUnitaireKg) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !vagueId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/ventes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          vagueId,
          quantitePoissons: parseInt(quantitePoissons),
          poidsTotalKg: parseFloat(poidsTotalKg),
          prixUnitaireKg: parseFloat(prixUnitaireKg),
          ...(notes.trim() && { notes: notes.trim() }),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: `Vente ${data.numero} creee`, variant: "success" });
        router.push("/ventes");
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const isValid =
    clientId &&
    vagueId &&
    parseInt(quantitePoissons) > 0 &&
    parseFloat(poidsTotalKg) > 0 &&
    parseFloat(prixUnitaireKg) > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/ventes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Ventes
      </Link>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Step 1: Client + Vague */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Client et vague</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger label="Client">
                <SelectValue placeholder="Selectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={vagueId} onValueChange={setVagueId}>
              <SelectTrigger label="Vague">
                <SelectValue placeholder="Selectionner une vague" />
              </SelectTrigger>
              <SelectContent>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.code} ({v.poissonsDisponibles} poissons)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVague && (
              <p className="text-xs text-muted-foreground">
                Poissons disponibles : {selectedVague.poissonsDisponibles}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Quantities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quantites et prix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              label="Nombre de poissons"
              type="number"
              min="1"
              max={selectedVague?.poissonsDisponibles ?? undefined}
              placeholder="Ex: 50"
              value={quantitePoissons}
              onChange={(e) => setQuantitePoissons(e.target.value)}
            />
            <Input
              label="Poids total (kg)"
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Ex: 42.5"
              value={poidsTotalKg}
              onChange={(e) => setPoidsTotalKg(e.target.value)}
            />
            <Input
              label="Prix unitaire (FCFA/kg)"
              type="number"
              min="1"
              placeholder="Ex: 2500"
              value={prixUnitaireKg}
              onChange={(e) => setPrixUnitaireKg(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Total preview */}
        {montantTotal > 0 && (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-2xl font-bold">
              {montantTotal.toLocaleString("fr-FR")} FCFA
            </p>
            <p className="text-xs text-muted-foreground">Montant total</p>
          </div>
        )}

        {/* Notes */}
        <Textarea
          label="Notes (optionnel)"
          placeholder="Informations complementaires..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <Button
          type="submit"
          disabled={submitting || !isValid}
          className="w-full min-h-[48px]"
        >
          {submitting ? <><FishLoader size="sm" /> Enregistrement...</> : <><ShoppingCart className="h-4 w-4 mr-2" /> Enregistrer la vente</>}
        </Button>
      </form>
    </div>
  );
}
