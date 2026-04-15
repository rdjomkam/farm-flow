"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  SexeReproducteur,
  StatutReproducteur,
  SourcingGeniteur,
  GenerationGeniteur,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeniteurMode = "GROUPE" | "INDIVIDUEL";

interface BacOption {
  id: string;
  nom: string;
}

interface GeniteurFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: GeniteurMode;
  bacs?: BacOption[];
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Form component
// ---------------------------------------------------------------------------

export function GeniteurForm({
  open,
  onOpenChange,
  mode,
  bacs = [],
  onSuccess,
}: GeniteurFormProps) {
  const t = useTranslations("reproduction.geniteurs");
  const tForm = useTranslations("reproduction.geniteurs.form");
  const tErrors = useTranslations("reproduction.errors");

  // --- Shared fields ---
  const [sexe, setSexe] = useState<SexeReproducteur>(SexeReproducteur.FEMELLE);
  const [origine, setOrigine] = useState("");
  const [sourcing, setSourcing] = useState<SourcingGeniteur>(SourcingGeniteur.ACHAT_FERMIER);
  const [generation, setGeneration] = useState<GenerationGeniteur>(GenerationGeniteur.INCONNUE);
  const [bacId, setBacId] = useState<string>("__none__");
  const [notes, setNotes] = useState("");
  const [dateAcquisition, setDateAcquisition] = useState("");

  // --- GROUPE-specific ---
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [nombrePoissons, setNombrePoissons] = useState("");
  const [poidsMoyenG, setPoidsMoyenG] = useState("");
  const [nombreMalesDisponibles, setNombreMalesDisponibles] = useState("");
  const [seuilAlerteMales, setSeuilAlerteMales] = useState("");

  // --- INDIVIDUEL-specific ---
  const [codeIndividuel, setCodeIndividuel] = useState("");
  const [poids, setPoids] = useState("");
  const [age, setAge] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sexeLabels: Record<SexeReproducteur, string> = {
    [SexeReproducteur.MALE]: t("sexe.MALE"),
    [SexeReproducteur.FEMELLE]: t("sexe.FEMELLE"),
  };

  const sourcingLabels: Record<SourcingGeniteur, string> = {
    [SourcingGeniteur.PROPRE_PRODUCTION]: t("sourcing.PROPRE_PRODUCTION"),
    [SourcingGeniteur.ACHAT_FERMIER]: t("sourcing.ACHAT_FERMIER"),
    [SourcingGeniteur.SAUVAGE]: t("sourcing.SAUVAGE"),
    [SourcingGeniteur.STATION_RECHERCHE]: t("sourcing.STATION_RECHERCHE"),
  };

  const generationLabels: Record<GenerationGeniteur, string> = {
    [GenerationGeniteur.G0_SAUVAGE]: t("generation.G0_SAUVAGE"),
    [GenerationGeniteur.G1]: t("generation.G1"),
    [GenerationGeniteur.G2]: t("generation.G2"),
    [GenerationGeniteur.G3_PLUS]: t("generation.G3_PLUS"),
    [GenerationGeniteur.INCONNUE]: t("generation.INCONNUE"),
  };

  function resetForm() {
    setSexe(SexeReproducteur.FEMELLE);
    setOrigine("");
    setSourcing(SourcingGeniteur.ACHAT_FERMIER);
    setGeneration(GenerationGeniteur.INCONNUE);
    setBacId("__none__");
    setNotes("");
    setDateAcquisition("");
    setNom("");
    setCode("");
    setNombrePoissons("");
    setPoidsMoyenG("");
    setNombreMalesDisponibles("");
    setSeuilAlerteMales("");
    setCodeIndividuel("");
    setPoids("");
    setAge("");
    setError(null);
  }

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
    if (!open) resetForm();
  }

  function isGroupeValid(): boolean {
    return nom.trim().length > 0 && parseInt(nombrePoissons, 10) > 0;
  }

  function isIndividuelValid(): boolean {
    return codeIndividuel.trim().length > 0 && parseFloat(poids) > 0;
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      let body: Record<string, unknown>;

      if (mode === "GROUPE") {
        body = {
          mode: "GROUPE",
          nom: nom.trim(),
          sexe,
          nombrePoissons: parseInt(nombrePoissons, 10),
          ...(code.trim() && { code: code.trim() }),
          ...(poidsMoyenG && { poidsMoyenG: parseFloat(poidsMoyenG) }),
          ...(origine.trim() && { origine: origine.trim() }),
          sourcing,
          generation,
          ...(dateAcquisition && { dateAcquisition }),
          ...(sexe === SexeReproducteur.MALE && nombreMalesDisponibles
            ? { nombreMalesDisponibles: parseInt(nombreMalesDisponibles, 10) }
            : {}),
          ...(sexe === SexeReproducteur.MALE && seuilAlerteMales
            ? { seuilAlerteMales: parseInt(seuilAlerteMales, 10) }
            : {}),
          ...(bacId !== "__none__" ? { bacId } : { bacId: null }),
          ...(notes.trim() && { notes: notes.trim() }),
          statut: StatutReproducteur.ACTIF,
        };
      } else {
        body = {
          mode: "INDIVIDUEL",
          code: codeIndividuel.trim(),
          sexe,
          poids: parseFloat(poids),
          ...(age && { age: parseInt(age, 10) }),
          ...(origine.trim() && { origine: origine.trim() }),
          ...(dateAcquisition && { dateAcquisition }),
          ...(notes.trim() && { notes: notes.trim() }),
        };
      }

      const res = await fetch("/api/reproduction/geniteurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error || tErrors("creationFailed");
        setError(msg);
        return;
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch {
      setError(tErrors("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid = mode === "GROUPE" ? isGroupeValid() : isIndividuelValid();
  const dialogTitle =
    mode === "GROUPE" ? tForm("titreGroupe") : tForm("titreIndividuel");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Sexe — shared */}
          <Select value={sexe} onValueChange={(v) => setSexe(v as SexeReproducteur)}>
            <SelectTrigger label={tForm("sexe")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(sexeLabels) as [SexeReproducteur, string][]).map(
                ([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {mode === "GROUPE" ? (
            <>
              {/* GROUPE fields */}
              <Input
                label={tForm("nom")}
                placeholder={tForm("nomPlaceholder")}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoFocus
              />
              <Input
                label={tForm("code")}
                placeholder={tForm("codePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Input
                label={tForm("nombrePoissons")}
                type="number"
                min={1}
                placeholder={tForm("nombrePoissonsPlaceholder")}
                value={nombrePoissons}
                onChange={(e) => setNombrePoissons(e.target.value)}
              />
              <Input
                label={tForm("poidsMoyenG")}
                type="number"
                min={0}
                placeholder={tForm("poidsMoyenGPlaceholder")}
                value={poidsMoyenG}
                onChange={(e) => setPoidsMoyenG(e.target.value)}
              />
              {/* Males-specific: only show if MALE */}
              {sexe === SexeReproducteur.MALE && (
                <>
                  <Input
                    label={tForm("nombreMalesDisponibles")}
                    type="number"
                    min={0}
                    placeholder={tForm("nombreMalesDisponiblesPlaceholder")}
                    value={nombreMalesDisponibles}
                    onChange={(e) => setNombreMalesDisponibles(e.target.value)}
                  />
                  <Input
                    label={tForm("seuilAlerteMales")}
                    type="number"
                    min={0}
                    placeholder={tForm("seuilAlerteMalesPlaceholder")}
                    value={seuilAlerteMales}
                    onChange={(e) => setSeuilAlerteMales(e.target.value)}
                  />
                </>
              )}
            </>
          ) : (
            <>
              {/* INDIVIDUEL fields */}
              <Input
                label={tForm("code")}
                placeholder={tForm("codeIndividuelPlaceholder")}
                value={codeIndividuel}
                onChange={(e) => setCodeIndividuel(e.target.value)}
                autoFocus
              />
              <Input
                label={tForm("poids")}
                type="number"
                min={0}
                placeholder={tForm("poidsPlaceholder")}
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
              />
              <Input
                label={tForm("age")}
                type="number"
                min={0}
                placeholder={tForm("agePlaceholder")}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </>
          )}

          {/* Shared optional fields */}
          <Input
            label={tForm("origine")}
            placeholder={tForm("originePlaceholder")}
            value={origine}
            onChange={(e) => setOrigine(e.target.value)}
          />

          <Select value={sourcing} onValueChange={(v) => setSourcing(v as SourcingGeniteur)}>
            <SelectTrigger label={tForm("sourcing")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(sourcingLabels) as [SourcingGeniteur, string][]).map(
                ([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Select value={generation} onValueChange={(v) => setGeneration(v as GenerationGeniteur)}>
            <SelectTrigger label={tForm("generation")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(generationLabels) as [GenerationGeniteur, string][]).map(
                ([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Input
            label={tForm("dateAcquisition")}
            type="date"
            value={dateAcquisition}
            onChange={(e) => setDateAcquisition(e.target.value)}
          />

          {/* Bac selector */}
          {bacs.length > 0 && (
            <Select value={bacId} onValueChange={setBacId}>
              <SelectTrigger label={tForm("bacId")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{tForm("aucunBac")}</SelectItem>
                {bacs.map((bac) => (
                  <SelectItem key={bac.id} value={bac.id}>
                    {bac.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            label={tForm("notes")}
            placeholder={tForm("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              {tForm("annuler")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {tForm("creer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
