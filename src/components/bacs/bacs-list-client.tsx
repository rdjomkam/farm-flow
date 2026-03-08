"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { BacResponse } from "@/types";

interface BacsListClientProps {
  bacs: BacResponse[];
}

export function BacsListClient({ bacs }: BacsListClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nom, setNom] = useState("");
  const [volume, setVolume] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setNom("");
    setVolume("");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!nom.trim()) newErrors.nom = "Le nom est obligatoire.";
    if (!volume || Number(volume) <= 0) newErrors.volume = "Le volume doit être supérieur à 0.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/bacs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), volume: Number(volume) }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la création.", variant: "error" });
        return;
      }

      toast({ title: "Bac créé avec succès !", variant: "success" });
      setDialogOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast({ title: "Erreur réseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-base font-semibold">
          {bacs.length} bac{bacs.length > 1 ? "s" : ""}
        </h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouveau bac
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau bac</DialogTitle>
              <DialogDescription>
                Ajoutez un nouveau contenant pour vos poissons.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="nom"
                label="Nom du bac"
                placeholder="Ex : Bac 1"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                error={errors.nom}
              />
              <Input
                id="volume"
                label="Volume (litres)"
                type="number"
                min="1"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                error={errors.volume}
              />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Création..." : "Créer le bac"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
        {bacs.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Aucun bac enregistré.
          </p>
        ) : (
          bacs.map((bac) => {
            const isOccupe = bac.vagueId !== null;
            return (
              <Card key={bac.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{bac.nom}</p>
                    <p className="text-sm text-muted-foreground">{bac.volume} L</p>
                  </div>
                  {isOccupe ? (
                    <Badge variant="warning">
                      {bac.vagueCode ?? "Occupé"}
                    </Badge>
                  ) : (
                    <Badge variant="info">Libre</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
