"use client";

import { useTranslations } from "next-intl";
import { ClipboardCheck } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ReleveFormFields } from "./releve-form-fields";
import type { ProduitOption } from "./consommation-fields";
import { useReleveForm } from "@/hooks/use-releve-form";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReleveFormClientProps {
  vagues: { id: string; code: string }[];
  produits: ProduitOption[];
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export function ReleveFormClient({ vagues, produits }: ReleveFormClientProps) {
  const t = useTranslations("releves");

  const form = useReleveForm({ produits });

  return (
    <ErrorBoundary section={t("errorSection.recordForm")}>
      <section>
        <h2 className="text-base font-semibold mb-4">{t("form.title")}</h2>

        {form.isFromActivite && (
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
            <ClipboardCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-primary">{t("form.activiteNotice.title")}</p>
              <p className="text-xs text-primary/80 mt-0.5">{t("form.activiteNotice.description")}</p>
            </div>
          </div>
        )}

        <ReleveFormFields
          vagues={vagues}
          produits={produits}
          vagueId={form.vagueId}
          bacId={form.bacId}
          typeReleve={form.typeReleve}
          releveDate={form.releveDate}
          notes={form.notes}
          fields={form.fields}
          errors={form.errors}
          consommations={form.consommations}
          activiteId={form.activiteId}
          activitesPlanifiees={form.activitesPlanifiees}
          loadingActivites={form.loadingActivites}
          loadingBacs={form.loadingBacs}
          bacs={form.bacs}
          isFromActivite={form.isFromActivite}
          initialTypeReleve={form.initialTypeReleve}
          initialBacId={form.initialBacId}
          releveActiviteTypeMap={form.releveActiviteTypeMap}
          onVagueChange={form.handleVagueChange}
          onBacChange={form.handleBacChange}
          onTypeReleveChange={form.handleTypeReleveChange}
          onRelEveDateChange={form.handleRelEveDateChange}
          onNotesChange={form.handleNotesChange}
          onActiviteChange={form.handleActiviteChange}
          updateField={form.updateField}
          onConsommationsChange={form.setConsommations}
          onSubmit={form.handleSubmit}
        />
      </section>
    </ErrorBoundary>
  );
}
