"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Card removed for density (CR-003)
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { FormSection } from "@/components/ui/form-section";
import { FormBiometrie } from "./form-biometrie";
import { FormMortalite } from "./form-mortalite";
import { FormAlimentation } from "./form-alimentation";
import { FormQualiteEau } from "./form-qualite-eau";
import { FormComptage } from "./form-comptage";
import { FormObservation } from "./form-observation";
import { ConsommationFields } from "./consommation-fields";
import type { ConsommationLine, ProduitOption } from "./consommation-fields";
import { TypeReleve, TypeActivite, StatutActivite, CategorieProduit, UniteStock, ACTIVITE_RELEVE_TYPE_MAP } from "@/types";
import type { BacResponse } from "@/types";
import { ClipboardCheck } from "lucide-react";

/** Inverse de ACTIVITE_RELEVE_TYPE_MAP : TypeReleve → TypeActivite compatible */
const RELEVE_ACTIVITE_TYPE_MAP: Partial<Record<string, TypeActivite>> = {};
for (const [typeActivite, typeReleve] of Object.entries(ACTIVITE_RELEVE_TYPE_MAP)) {
  if (typeReleve) {
    RELEVE_ACTIVITE_TYPE_MAP[typeReleve] = typeActivite as TypeActivite;
  }
}

interface ActivitePlanifiee {
  id: string;
  titre: string;
  dateDebut: string | Date;
  statut: string;
  releveId: string | null;
}

const uniteLabels: Record<string, string> = {
  [UniteStock.GRAMME]: "g",
  [UniteStock.KG]: "kg",
  [UniteStock.MILLILITRE]: "mL",
  [UniteStock.LITRE]: "L",
  [UniteStock.UNITE]: "unite",
  [UniteStock.SACS]: "sacs",
};

const typeLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité de l'eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
};

interface ReleveFormClientProps {
  vagues: { id: string; code: string }[];
  produits: ProduitOption[];
}

export function ReleveFormClient({ vagues, produits }: ReleveFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Parametres pre-remplis depuis une activite (query params)
  const initialActiviteId = searchParams.get("activiteId") ?? "";
  const initialTypeReleve = searchParams.get("typeReleve") ?? "";
  const initialBacId = searchParams.get("bacId") ?? "";
  // Indique si le formulaire est pre-rempli depuis une activite (verrouiller certains champs)
  const isFromActivite = Boolean(initialActiviteId);

  const [vagueId, setVagueId] = useState(searchParams.get("vagueId") ?? "");
  const [bacId, setBacId] = useState(initialBacId);
  const [typeReleve, setTypeReleve] = useState(initialTypeReleve);
  const [notes, setNotes] = useState("");
  const [bacs, setBacs] = useState<BacResponse[]>([]);
  const [loadingBacs, setLoadingBacs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consommations, setConsommations] = useState<ConsommationLine[]>([]);

  // Liaison activité planifiée (optionnelle, ou pre-remplie depuis query param)
  const [activiteId, setActiviteId] = useState(initialActiviteId);
  const [activitesPlanifiees, setActivitesPlanifiees] = useState<ActivitePlanifiee[]>([]);
  const [loadingActivites, setLoadingActivites] = useState(false);

  // Type-specific field values
  const [fields, setFields] = useState<Record<string, string>>({});

  function updateField(field: string, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  // Load bacs when vague changes
  useEffect(() => {
    if (!vagueId) {
      setBacs([]);
      if (!isFromActivite) setBacId("");
      return;
    }
    setLoadingBacs(true);
    // Ne pas reset bacId si pre-rempli depuis une activite
    if (!isFromActivite) setBacId("");
    fetch(`/api/bacs?vagueId=${vagueId}`)
      .then((res) => res.json())
      .then((data) => {
        const vagueBacs = (data.bacs ?? []).filter(
          (b: BacResponse) => b.vagueId === vagueId
        );
        setBacs(vagueBacs);
      })
      .catch(() => setBacs([]))
      .finally(() => setLoadingBacs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vagueId]);

  // Reset type-specific fields et consommations quand le type change
  // Ne pas reset activiteId si on vient d'une activite (pre-rempli)
  useEffect(() => {
    setFields({});
    setConsommations([]);
    if (!isFromActivite) {
      setActiviteId("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeReleve]);

  // Charger les activites planifiees compatibles quand vagueId ou typeReleve changent
  useEffect(() => {
    setActivitesPlanifiees([]);
    setActiviteId("");

    if (!vagueId || !typeReleve) return;

    const typeActiviteCompat = RELEVE_ACTIVITE_TYPE_MAP[typeReleve];
    if (!typeActiviteCompat) return; // MORTALITE, OBSERVATION — pas de mapping

    setLoadingActivites(true);
    fetch(`/api/activites?vagueId=${encodeURIComponent(vagueId)}&typeActivite=${encodeURIComponent(typeActiviteCompat)}`)
      .then((res) => res.json())
      .then((data) => {
        const compatibles = (data.activites ?? []).filter(
          (a: ActivitePlanifiee) =>
            (a.statut === StatutActivite.PLANIFIEE || a.statut === StatutActivite.EN_RETARD) &&
            !a.releveId
        );
        setActivitesPlanifiees(compatibles);
      })
      .catch(() => setActivitesPlanifiees([]))
      .finally(() => setLoadingActivites(false));
  }, [vagueId, typeReleve]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!vagueId) errs.vagueId = "Sélectionnez une vague.";
    if (!bacId) errs.bacId = "Sélectionnez un bac.";
    if (!typeReleve) errs.typeReleve = "Sélectionnez un type de relevé.";

    if (typeReleve === TypeReleve.BIOMETRIE) {
      if (!fields.poidsMoyen || Number(fields.poidsMoyen) <= 0)
        errs.poidsMoyen = "Requis (> 0).";
      if (!fields.tailleMoyenne || Number(fields.tailleMoyenne) <= 0)
        errs.tailleMoyenne = "Requis (> 0).";
      if (!fields.echantillonCount || Number(fields.echantillonCount) <= 0)
        errs.echantillonCount = "Requis (> 0).";
    }
    if (typeReleve === TypeReleve.MORTALITE) {
      if (fields.nombreMorts == null || fields.nombreMorts === "" || Number(fields.nombreMorts) < 0)
        errs.nombreMorts = "Requis (>= 0).";
      if (!fields.causeMortalite) errs.causeMortalite = "Requis.";
    }
    if (typeReleve === TypeReleve.ALIMENTATION) {
      if (!fields.quantiteAliment || Number(fields.quantiteAliment) <= 0)
        errs.quantiteAliment = "Requis (> 0).";
      if (!fields.typeAliment) errs.typeAliment = "Requis.";
      if (!fields.frequenceAliment || Number(fields.frequenceAliment) <= 0)
        errs.frequenceAliment = "Requis (> 0).";
    }
    if (typeReleve === TypeReleve.COMPTAGE) {
      if (fields.nombreCompte == null || fields.nombreCompte === "" || Number(fields.nombreCompte) < 0)
        errs.nombreCompte = "Requis (>= 0).";
      if (!fields.methodeComptage) errs.methodeComptage = "Requis.";
    }
    if (typeReleve === TypeReleve.OBSERVATION) {
      if (!fields.description?.trim()) errs.description = "Requis.";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setErrors({});

    const body: Record<string, unknown> = {
      vagueId,
      bacId,
      typeReleve,
      ...(notes.trim() && { notes: notes.trim() }),
      ...(activiteId && { activiteId }),
    };

    // Add type-specific numeric fields
    const numericFields = [
      "poidsMoyen", "tailleMoyenne", "echantillonCount",
      "nombreMorts", "quantiteAliment", "frequenceAliment",
      "nombreCompte", "temperature", "ph", "oxygene", "ammoniac",
    ];
    for (const f of numericFields) {
      if (fields[f] !== undefined && fields[f] !== "") {
        body[f] = Number(fields[f]);
      }
    }
    // String fields
    const stringFields = ["causeMortalite", "typeAliment", "methodeComptage", "description"];
    for (const f of stringFields) {
      if (fields[f]) {
        body[f] = f === "description" ? fields[f].trim() : fields[f];
      }
    }

    // Consommations de stock
    const validConsos = consommations.filter(
      (c) => c.produitId && c.quantite && Number(c.quantite) > 0
    );
    if (validConsos.length > 0) {
      body.consommations = validConsos.map((c) => ({
        produitId: c.produitId,
        quantite: Number(c.quantite),
      }));
    }

    try {
      const res = await fetch("/api/releves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la création.", variant: "error" });
        return;
      }

      toast({ title: "Relevé enregistré !", variant: "success" });
      router.push(`/vagues/${vagueId}`);
      router.refresh();
    } catch {
      toast({ title: "Erreur réseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Saisir un releve</h2>

      {/* Bannière informative si pre-rempli depuis une activite */}
      {isFromActivite && (
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
          <ClipboardCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-primary">Completion d'activite</p>
            <p className="text-xs text-primary/80 mt-0.5">
              Ce releve sera automatiquement lie a l'activite planifiee et la marquera comme terminee.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormSection title="Identification" description="Vague et bac concernés">
            <Select value={vagueId} onValueChange={setVagueId} disabled={isFromActivite && Boolean(vagueId)}>
              <SelectTrigger label="Vague" error={errors.vagueId}>
                <SelectValue placeholder="Sélectionner une vague" />
              </SelectTrigger>
              <SelectContent>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={bacId} onValueChange={setBacId} disabled={!vagueId || loadingBacs || (isFromActivite && Boolean(initialBacId))}>
              <SelectTrigger label="Bac" error={errors.bacId}>
                <SelectValue
                  placeholder={
                    loadingBacs ? "Chargement..." : !vagueId ? "Sélectionnez d'abord une vague" : "Sélectionner un bac"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {bacs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nom} ({b.volume}L)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormSection>

          <FormSection title="Type de releve" description="Choisissez le type de mesure">
            <Select value={typeReleve} onValueChange={setTypeReleve} disabled={isFromActivite && Boolean(initialTypeReleve)}>
              <SelectTrigger label="Type de relevé" error={errors.typeReleve}>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypeReleve).map((t) => (
                  <SelectItem key={t} value={t}>
                    {typeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Select activite planifiee — uniquement pour les types avec mapping */}
            {vagueId && typeReleve && RELEVE_ACTIVITE_TYPE_MAP[typeReleve] && (
              isFromActivite ? (
                /* Champ en lecture seule quand pre-rempli depuis une activite */
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Activite liee</span>
                  <div className="flex h-11 w-full items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
                    <ClipboardCheck className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                    Activite selectionnee (liee automatiquement)
                  </div>
                </div>
              ) : (
                <Select
                  value={activiteId || "__auto__"}
                  onValueChange={(val) => setActiviteId(val === "__auto__" ? "" : val)}
                  disabled={loadingActivites}
                >
                  <SelectTrigger label="Activité planifiée (optionnel)">
                    <SelectValue
                      placeholder={
                        loadingActivites
                          ? "Chargement..."
                          : activitesPlanifiees.length === 0
                          ? "Auto-détection (aucune activité planifiée)"
                          : "Auto-détection"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activitesPlanifiees.length > 0 && (
                      <SelectItem value="__auto__">Auto-détection</SelectItem>
                    )}
                    {activitesPlanifiees.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.titre}
                        {" · "}
                        {new Date(a.dateDebut).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                        {a.statut === StatutActivite.EN_RETARD && " ⚠"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}
          </FormSection>

          {typeReleve === TypeReleve.BIOMETRIE && (
            <FormSection title="Mesures biométriques" description="Poids, taille et échantillon">
              <FormBiometrie
                values={{
                  poidsMoyen: fields.poidsMoyen ?? "",
                  tailleMoyenne: fields.tailleMoyenne ?? "",
                  echantillonCount: fields.echantillonCount ?? "",
                }}
                onChange={updateField}
                errors={errors}
              />
            </FormSection>
          )}
          {typeReleve === TypeReleve.MORTALITE && (
            <>
              <FormSection title="Mortalité" description="Nombre et cause">
                <FormMortalite
                  values={{
                    nombreMorts: fields.nombreMorts ?? "",
                    causeMortalite: fields.causeMortalite ?? "",
                  }}
                  onChange={updateField}
                  errors={errors}
                />
              </FormSection>
              <FormSection title="Consommation de stock" description="Produits utilisés (optionnel)">
                <ConsommationFields
                  lignes={consommations}
                  onChange={setConsommations}
                  produits={produits}
                  categorie={CategorieProduit.INTRANT}
                  optional
                />
              </FormSection>
            </>
          )}
          {typeReleve === TypeReleve.ALIMENTATION && (() => {
            const firstAlimentLine = consommations.find((c) => c.produitId);
            const firstProduit = firstAlimentLine
              ? produits.find((p) => p.id === firstAlimentLine.produitId && p.categorie === CategorieProduit.ALIMENT)
              : undefined;
            const uniteAliment = firstProduit
              ? (uniteLabels[firstProduit.unite] ?? firstProduit.unite)
              : undefined;
            return (
            <>
              <FormSection title="Alimentation" description="Quantité et type d'aliment">
                <FormAlimentation
                  values={{
                    quantiteAliment: fields.quantiteAliment ?? "",
                    typeAliment: fields.typeAliment ?? "",
                    frequenceAliment: fields.frequenceAliment ?? "",
                  }}
                  onChange={updateField}
                  errors={errors}
                  uniteAliment={uniteAliment}
                />
              </FormSection>
              <FormSection title="Consommation de stock" description="Produits consommés">
                <ConsommationFields
                  lignes={consommations}
                  onChange={setConsommations}
                  produits={produits}
                  categorie={CategorieProduit.ALIMENT}
                />
              </FormSection>
            </>
            );
          })()}
          {typeReleve === TypeReleve.QUALITE_EAU && (
            <>
              <FormSection title="Qualité de l'eau" description="Paramètres physico-chimiques">
                <FormQualiteEau
                  values={{
                    temperature: fields.temperature ?? "",
                    ph: fields.ph ?? "",
                    oxygene: fields.oxygene ?? "",
                    ammoniac: fields.ammoniac ?? "",
                  }}
                  onChange={updateField}
                />
              </FormSection>
              <FormSection title="Consommation de stock" description="Produits utilisés (optionnel)">
                <ConsommationFields
                  lignes={consommations}
                  onChange={setConsommations}
                  produits={produits}
                  categorie={CategorieProduit.INTRANT}
                  optional
                />
              </FormSection>
            </>
          )}
          {typeReleve === TypeReleve.COMPTAGE && (
            <FormSection title="Comptage" description="Nombre et méthode">
              <FormComptage
                values={{
                  nombreCompte: fields.nombreCompte ?? "",
                  methodeComptage: fields.methodeComptage ?? "",
                }}
                onChange={updateField}
                errors={errors}
              />
            </FormSection>
          )}
          {typeReleve === TypeReleve.OBSERVATION && (
            <FormSection title="Observation" description="Description libre">
              <FormObservation
                values={{ description: fields.description ?? "" }}
                onChange={updateField}
                errors={errors}
              />
            </FormSection>
          )}

          {/* Notes */}
          <Input
            id="notes"
            label="Notes (optionnel)"
            placeholder="Remarques complémentaires..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Submit */}
          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? "Enregistrement..." : "Enregistrer le relevé"}
          </Button>
        </form>
    </section>
  );
}
