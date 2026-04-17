"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ClipboardCheck } from "lucide-react";
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
import { ReleveTypeSections } from "./releve-type-sections";
import type { ConsommationLine, ProduitOption } from "./consommation-fields";
import { TypeReleve, StatutActivite, CategorieProduit } from "@/types";
import type { TriFields } from "@/hooks/use-releve-form";
import type { BacResponse } from "@/types";
import type { TypedFormFields, ActivitePlanifiee } from "@/hooks/use-releve-form";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowDatetimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReleveFormFieldsProps {
  vagues: { id: string; code: string }[];
  produits: ProduitOption[];
  vagueId: string;
  bacId: string;
  typeReleve: string;
  releveDate: string;
  notes: string;
  fields: TypedFormFields;
  errors: Record<string, string>;
  consommations: ConsommationLine[];
  activiteId: string;
  activitesPlanifiees: ActivitePlanifiee[];
  loadingActivites: boolean;
  loadingBacs: boolean;
  bacs: BacResponse[];
  isFromActivite: boolean;
  initialTypeReleve: string;
  initialBacId: string;
  releveActiviteTypeMap: Partial<Record<string, string>>;
  onVagueChange: (val: string) => void;
  onBacChange: (val: string) => void;
  onTypeReleveChange: (val: string) => void;
  onRelEveDateChange: (val: string) => void;
  onNotesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onActiviteChange: (val: string) => void;
  updateField: (field: string, value: string) => void;
  onConsommationsChange: (lignes: ConsommationLine[]) => void;
  onSubmit: (e: React.FormEvent) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReleveFormFields({
  vagues,
  produits,
  vagueId,
  bacId,
  typeReleve,
  releveDate,
  notes,
  fields,
  errors,
  consommations,
  activiteId,
  activitesPlanifiees,
  loadingActivites,
  loadingBacs,
  bacs,
  isFromActivite,
  initialTypeReleve,
  initialBacId,
  releveActiviteTypeMap,
  onVagueChange,
  onBacChange,
  onTypeReleveChange,
  onRelEveDateChange,
  onNotesChange,
  onActiviteChange,
  updateField,
  onConsommationsChange,
  onSubmit,
}: ReleveFormFieldsProps) {
  const t = useTranslations("releves");
  const tStock = useTranslations("stock");
  const locale = useLocale();

  /** Releve TRI lie directement a un lot d'alevins (sans vague/bac) */
  const isTriWithLot =
    fields.typeReleve === TypeReleve.TRI &&
    Boolean((fields as unknown as TriFields).lotAlevinsId);

  /** Unite de l'aliment derive de la premiere ligne de consommation */
  const uniteAliment = useMemo((): string | undefined => {
    if (typeReleve !== TypeReleve.ALIMENTATION) return undefined;
    const firstLine = consommations.find((c) => c.produitId);
    const produit = firstLine
      ? produits.find((p) => p.id === firstLine.produitId && p.categorie === CategorieProduit.ALIMENT)
      : undefined;
    return produit
      ? tStock(`unites.${produit.unite as "GRAMME" | "KG" | "MILLILITRE" | "LITRE" | "UNITE" | "SACS"}`)
      : undefined;
  }, [typeReleve, consommations, produits, tStock]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {/* Zone d'annonce globale des erreurs pour les lecteurs d'écran */}
      {Object.keys(errors).length > 0 && (
        <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          {t("form.erreurFormulaire", {
            count: Object.keys(errors).length,
            plural: Object.keys(errors).length > 1 ? "s" : "",
          })}
        </div>
      )}

      {/* Section identification — masquee pour TRI lie a un lot d'alevins */}
      {!isTriWithLot && (
        <FormSection
          title={t("form.sections.identification.title")}
          description={t("form.sections.identification.description")}
        >
          <Select value={vagueId} onValueChange={onVagueChange} disabled={isFromActivite && Boolean(vagueId)}>
            <SelectTrigger label={t("form.fields.vague")} required error={errors.vagueId}>
              <SelectValue placeholder={t("form.fields.vaguePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {vagues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={bacId}
            onValueChange={onBacChange}
            disabled={!vagueId || loadingBacs || (isFromActivite && Boolean(initialBacId))}
          >
            <SelectTrigger label={t("form.fields.bac")} required error={errors.bacId}>
              <SelectValue
                placeholder={
                  loadingBacs ? t("form.fields.bacChargement")
                    : !vagueId ? t("form.fields.bacSelectVagueFirst")
                    : t("form.fields.bacPlaceholder")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {bacs.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.nom} ({b.volume}L)</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSection>
      )}

      {/* Section date */}
      <FormSection
        title={t("form.sections.date.title")}
        description={t("form.sections.date.description")}
      >
        <Input
          type="datetime-local"
          label={t("form.fields.dateHeure")}
          required
          value={releveDate}
          onChange={(e) => onRelEveDateChange(e.target.value)}
          max={nowDatetimeLocal()}
        />
      </FormSection>

      {/* Section type + liaison activite */}
      <FormSection
        title={t("form.sections.type.title")}
        description={t("form.sections.type.description")}
      >
        <Select
          value={typeReleve}
          onValueChange={onTypeReleveChange}
          disabled={isFromActivite && Boolean(initialTypeReleve)}
        >
          <SelectTrigger label={t("form.fields.typeReleve")} required error={errors.typeReleve}>
            <SelectValue placeholder={t("form.fields.typeRelevePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {Object.values(TypeReleve).map((tp) => (
              <SelectItem key={tp} value={tp}>{t(`types.${tp}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {vagueId && typeReleve && releveActiviteTypeMap[typeReleve] && (
          isFromActivite ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">{t("form.fields.activiteLiee")}</span>
              <div className="flex h-11 w-full items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
                <ClipboardCheck className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                {t("form.fields.activiteSelectionnee")}
              </div>
            </div>
          ) : (
            <Select value={activiteId || "__auto__"} onValueChange={onActiviteChange} disabled={loadingActivites}>
              <SelectTrigger label={t("form.fields.activitePlanifiee")}>
                <SelectValue
                  placeholder={
                    loadingActivites ? t("form.fields.bacChargement")
                      : activitesPlanifiees.length === 0 ? t("form.fields.autoDetectionNone")
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
                    {a.titre}{" · "}{new Date(a.dateDebut).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    {a.statut === StatutActivite.EN_RETARD && " ⚠"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        )}
      </FormSection>

      {/* Sections spécifiques au type de relevé */}
      <ReleveTypeSections
        fields={fields}
        errors={errors}
        consommations={consommations}
        produits={produits}
        bacs={bacs}
        bacId={bacId}
        uniteAliment={uniteAliment}
        updateField={updateField}
        onConsommationsChange={onConsommationsChange}
      />

      {/* Notes */}
      <Input
        id="notes"
        label={t("form.fields.notes")}
        placeholder={t("form.fields.notesPlaceholder")}
        value={notes}
        onChange={onNotesChange}
      />

      {/* Submit */}
      <Button type="submit" className="mt-2">
        {t("form.fields.submit")}
      </Button>
    </form>
  );
}
