"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FormSection } from "@/components/ui/form-section";
import { FormBiometrie } from "./form-biometrie";
import { FormMortalite } from "./form-mortalite";
import { FormAlimentation } from "./form-alimentation";
import { FormQualiteEau } from "./form-qualite-eau";
import { FormComptage } from "./form-comptage";
import { FormObservation } from "./form-observation";
import { FormRenouvellement } from "./form-renouvellement";
import { ConsommationFields } from "./consommation-fields";
import type { ConsommationLine, ProduitOption } from "./consommation-fields";
import { TypeReleve, TypeActivite, StatutActivite, CategorieProduit, ACTIVITE_RELEVE_TYPE_MAP } from "@/types";
import type { BacResponse } from "@/types";
import { ClipboardCheck } from "lucide-react";
import { useBacService, useActiviteService, useReleveService } from "@/services";
import { useBacsList } from "@/hooks/queries/use-bacs-queries";
import { queryKeys } from "@/lib/query-keys";

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


interface ReleveFormClientProps {
  vagues: { id: string; code: string }[];
  produits: ProduitOption[];
}

export function ReleveFormClient({ vagues, produits }: ReleveFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bacService = useBacService();
  const activiteService = useActiviteService();
  const releveService = useReleveService();
  const queryClient = useQueryClient();
  const t = useTranslations("releves");
  const tStock = useTranslations("stock");

  // Parametres pre-remplis depuis une activite (query params)
  const initialActiviteId = searchParams.get("activiteId") ?? "";
  const initialTypeReleve = searchParams.get("typeReleve") ?? "";
  const initialBacId = searchParams.get("bacId") ?? "";
  // Indique si le formulaire est pre-rempli depuis une activite (verrouiller certains champs)
  const isFromActivite = Boolean(initialActiviteId);

  const [vagueId, setVagueId] = useState(searchParams.get("vagueId") ?? "");
  const [bacId, setBacId] = useState(initialBacId);
  const [typeReleve, setTypeReleve] = useState(initialTypeReleve);
  const [releveDate, setReleveDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [notes, setNotes] = useState("");
  // Use TanStack Query for bacs loading
  const { data: bacsData, isLoading: loadingBacs } = useBacsList(
    vagueId ? { vagueId } : undefined,
    { enabled: !!vagueId }
  );
  const bacs = (bacsData ?? []).filter((b: BacResponse) => b.vagueId === vagueId);
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

  // Reset bacId when vague changes (unless pre-filled from activity)
  useEffect(() => {
    if (!isFromActivite) setBacId("");
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
    activiteService.list({ vagueId, typeActivite: typeActiviteCompat }).then((result) => {
      if (result.ok && result.data) {
        const compatibles = (result.data.activites ?? []).filter(
          (a: ActivitePlanifiee) =>
            (a.statut === StatutActivite.PLANIFIEE || a.statut === StatutActivite.EN_RETARD) &&
            !a.releveId
        );
        setActivitesPlanifiees(compatibles);
      } else {
        setActivitesPlanifiees([]);
      }
      setLoadingActivites(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vagueId, typeReleve]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!vagueId) errs.vagueId = t("form.errors.vagueId");
    if (!bacId) errs.bacId = t("form.errors.bacId");
    if (!typeReleve) errs.typeReleve = t("form.errors.typeReleve");

    if (typeReleve === TypeReleve.BIOMETRIE) {
      if (!fields.poidsMoyen || Number(fields.poidsMoyen) <= 0)
        errs.poidsMoyen = t("form.errors.poidsMoyen");
      if (fields.tailleMoyenne && Number(fields.tailleMoyenne) <= 0)
        errs.tailleMoyenne = t("form.errors.tailleMoyenne");
      if (!fields.echantillonCount || Number(fields.echantillonCount) <= 0)
        errs.echantillonCount = t("form.errors.echantillonCount");
    }
    if (typeReleve === TypeReleve.MORTALITE) {
      if (fields.nombreMorts == null || fields.nombreMorts === "" || Number(fields.nombreMorts) < 0)
        errs.nombreMorts = t("form.errors.nombreMorts");
      if (!fields.causeMortalite) errs.causeMortalite = t("form.errors.causeMortalite");
    }
    if (typeReleve === TypeReleve.ALIMENTATION) {
      if (!fields.quantiteAliment || Number(fields.quantiteAliment) <= 0)
        errs.quantiteAliment = t("form.errors.quantiteAliment");
      if (!fields.typeAliment) errs.typeAliment = t("form.errors.typeAliment");
      if (!fields.frequenceAliment || Number(fields.frequenceAliment) <= 0)
        errs.frequenceAliment = t("form.errors.frequenceAliment");
    }
    if (typeReleve === TypeReleve.COMPTAGE) {
      if (fields.nombreCompte == null || fields.nombreCompte === "" || Number(fields.nombreCompte) < 0)
        errs.nombreCompte = t("form.errors.nombreCompte");
      if (!fields.methodeComptage) errs.methodeComptage = t("form.errors.methodeComptage");
    }
    if (typeReleve === TypeReleve.OBSERVATION) {
      if (!fields.description?.trim()) errs.description = t("form.errors.description");
    }
    if (typeReleve === TypeReleve.RENOUVELLEMENT) {
      const hasPct = fields.pourcentageRenouvellement !== undefined && fields.pourcentageRenouvellement !== "";
      const hasVol = fields.volumeRenouvele !== undefined && fields.volumeRenouvele !== "";
      if (!hasPct && !hasVol) {
        errs.pourcentageRenouvellement = t("form.errors.renouvellementRequis");
      }
      if (hasPct && (Number(fields.pourcentageRenouvellement) < 0 || Number(fields.pourcentageRenouvellement) > 100)) {
        errs.pourcentageRenouvellement = t("form.errors.pourcentageRange");
      }
      if (hasVol && Number(fields.volumeRenouvele) <= 0) {
        errs.volumeRenouvele = t("form.errors.volumePositif");
      }
      if (fields.nombreRenouvellements !== undefined && fields.nombreRenouvellements !== "") {
        const n = Number(fields.nombreRenouvellements);
        if (!Number.isInteger(n) || n < 1 || n > 20) {
          errs.nombreRenouvellements = t("form.errors.nombreRenouvellementMin");
        }
      }
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

    setErrors({});

    const body: Record<string, unknown> = {
      vagueId,
      bacId,
      typeReleve,
      ...(notes.trim() && { notes: notes.trim() }),
      ...(activiteId && { activiteId }),
      // Convert datetime-local (local time) to ISO string so the server gets correct UTC
      date: new Date(releveDate).toISOString(),
    };

    // Add type-specific numeric fields
    const numericFields = [
      "poidsMoyen", "tailleMoyenne", "echantillonCount",
      "nombreMorts", "quantiteAliment", "frequenceAliment",
      "nombreCompte", "temperature", "ph", "oxygene", "ammoniac",
      "pourcentageRenouvellement", "volumeRenouvele", "nombreRenouvellements",
      "tauxRefus",
    ];
    for (const f of numericFields) {
      if (fields[f] !== undefined && fields[f] !== "") {
        body[f] = Number(fields[f]);
      }
    }
    // String fields
    const stringFields = ["causeMortalite", "typeAliment", "methodeComptage", "description", "comportementAlim"];
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

    const result = await releveService.create(body as unknown as Parameters<typeof releveService.create>[0]);

    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.detail(vagueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      router.push(`/vagues/${vagueId}`);
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">{t("form.title")}</h2>

      {/* Bannière informative si pre-rempli depuis une activite */}
      {isFromActivite && (
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
          <ClipboardCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-primary">{t("form.activiteNotice.title")}</p>
            <p className="text-xs text-primary/80 mt-0.5">
              {t("form.activiteNotice.description")}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormSection title={t("form.sections.identification.title")} description={t("form.sections.identification.description")}>
            <Select value={vagueId} onValueChange={setVagueId} disabled={isFromActivite && Boolean(vagueId)}>
              <SelectTrigger label={t("form.fields.vague")} error={errors.vagueId}>
                <SelectValue placeholder={t("form.fields.vaguePlaceholder")} />
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
              <SelectTrigger label={t("form.fields.bac")} error={errors.bacId}>
                <SelectValue
                  placeholder={
                    loadingBacs ? t("form.fields.bacChargement") : !vagueId ? t("form.fields.bacSelectVagueFirst") : t("form.fields.bacPlaceholder")
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

          <FormSection title={t("form.sections.date.title")} description={t("form.sections.date.description")}>
            <Input
              type="datetime-local"
              label={t("form.fields.dateHeure")}
              value={releveDate}
              onChange={(e) => setReleveDate(e.target.value)}
              max={(() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
              })()}
            />
          </FormSection>

          <FormSection title={t("form.sections.type.title")} description={t("form.sections.type.description")}>
            <Select value={typeReleve} onValueChange={setTypeReleve} disabled={isFromActivite && Boolean(initialTypeReleve)}>
              <SelectTrigger label={t("form.fields.typeReleve")} error={errors.typeReleve}>
                <SelectValue placeholder={t("form.fields.typeRelevePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypeReleve).map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {t(`types.${tp}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Select activite planifiee — uniquement pour les types avec mapping */}
            {vagueId && typeReleve && RELEVE_ACTIVITE_TYPE_MAP[typeReleve] && (
              isFromActivite ? (
                /* Champ en lecture seule quand pre-rempli depuis une activite */
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">{t("form.fields.activiteLiee")}</span>
                  <div className="flex h-11 w-full items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
                    <ClipboardCheck className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                    {t("form.fields.activiteSelectionnee")}
                  </div>
                </div>
              ) : (
                <Select
                  value={activiteId || "__auto__"}
                  onValueChange={(val) => setActiviteId(val === "__auto__" ? "" : val)}
                  disabled={loadingActivites}
                >
                  <SelectTrigger label={t("form.fields.activitePlanifiee")}>
                    <SelectValue
                      placeholder={
                        loadingActivites
                          ? t("form.fields.bacChargement")
                          : activitesPlanifiees.length === 0
                          ? t("form.fields.autoDetectionNone")
                          : t("form.fields.autoDetection")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activitesPlanifiees.length > 0 && (
                      <SelectItem value="__auto__">{t("form.fields.autoDetection")}</SelectItem>
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
            <FormSection title={t("form.sections.biometrie.title")} description={t("form.sections.biometrie.description")}>
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
              <FormSection title={t("form.sections.mortalite.title")} description={t("form.sections.mortalite.description")}>
                <FormMortalite
                  values={{
                    nombreMorts: fields.nombreMorts ?? "",
                    causeMortalite: fields.causeMortalite ?? "",
                  }}
                  onChange={updateField}
                  errors={errors}
                />
              </FormSection>
              <FormSection title={t("form.sections.consommationStock.title")} description={t("form.sections.consommationStock.descriptionIntrant")}>
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
              ? tStock(`unites.${firstProduit.unite as "GRAMME" | "KG" | "MILLILITRE" | "LITRE" | "UNITE" | "SACS"}`)
              : undefined;
            return (
            <>
              <FormSection title={t("form.sections.alimentation.title")} description={t("form.sections.alimentation.description")}>
                <FormAlimentation
                  values={{
                    quantiteAliment: fields.quantiteAliment ?? "",
                    typeAliment: fields.typeAliment ?? "",
                    frequenceAliment: fields.frequenceAliment ?? "",
                    tauxRefus: fields.tauxRefus ?? "",
                    comportementAlim: fields.comportementAlim ?? "",
                  }}
                  onChange={updateField}
                  errors={errors}
                  uniteAliment={uniteAliment}
                />
              </FormSection>
              <FormSection title={t("form.sections.consommationStock.title")} description={t("form.sections.consommationStock.descriptionAliment")}>
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
              <FormSection title={t("form.sections.qualiteEau.title")} description={t("form.sections.qualiteEau.description")}>
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
              <FormSection title={t("form.sections.consommationStock.title")} description={t("form.sections.consommationStock.descriptionIntrant")}>
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
            <FormSection title={t("form.sections.comptage.title")} description={t("form.sections.comptage.description")}>
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
            <FormSection title={t("form.sections.observation.title")} description={t("form.sections.observation.description")}>
              <FormObservation
                values={{ description: fields.description ?? "" }}
                onChange={updateField}
                errors={errors}
              />
            </FormSection>
          )}
          {typeReleve === TypeReleve.RENOUVELLEMENT && (() => {
            const selectedBac = bacs.find((b) => b.id === bacId);
            return (
              <FormRenouvellement
                values={{
                  pourcentageRenouvellement: fields.pourcentageRenouvellement ?? "",
                  volumeRenouvele: fields.volumeRenouvele ?? "",
                  nombreRenouvellements: fields.nombreRenouvellements ?? "1",
                }}
                onChange={updateField}
                errors={errors}
                bacVolumeLitres={selectedBac?.volume ?? null}
              />
            );
          })()}

          {/* Notes */}
          <Input
            id="notes"
            label={t("form.fields.notes")}
            placeholder={t("form.fields.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Submit */}
          <Button type="submit" className="mt-2">
            {t("form.fields.submit")}
          </Button>
        </form>
    </section>
  );
}
