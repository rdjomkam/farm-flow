"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  TypeReleve,
  TypeActivite,
  StatutActivite,
  CategorieProduit,
  ACTIVITE_RELEVE_TYPE_MAP,
} from "@/types";
import type { BacResponse } from "@/types";
import type { ConsommationLine, ProduitOption } from "@/components/releves/consommation-fields";
import { useActiviteService, useReleveService } from "@/services";
import { useBacsList } from "@/hooks/queries/use-bacs-queries";
import { queryKeys } from "@/lib/query-keys";
import { validateReleveForm } from "@/lib/releve-form-validation";
import { buildReleveDTO } from "@/lib/releve-form-dto";

// ---------------------------------------------------------------------------
// Types discrimines pour l'etat du formulaire
// ---------------------------------------------------------------------------

export interface BiometrieFields {
  poidsMoyen: string;
  tailleMoyenne: string;
  echantillonCount: string;
}

export interface MortaliteFields {
  nombreMorts: string;
  causeMortalite: string;
}

export interface AlimentationFields {
  quantiteAliment: string;
  typeAliment: string;
  frequenceAliment: string;
  tauxRefus: string;
  comportementAlim: string;
}

export interface QualiteEauFields {
  temperature: string;
  ph: string;
  oxygene: string;
  ammoniac: string;
}

export interface ComptageFields {
  nombreCompte: string;
  methodeComptage: string;
}

export interface ObservationFields {
  description: string;
}

export interface RenouvellementFields {
  pourcentageRenouvellement: string;
  volumeRenouvele: string;
  nombreRenouvellements: string;
}

export type TypedFormFields =
  | ({ typeReleve: TypeReleve.BIOMETRIE } & BiometrieFields)
  | ({ typeReleve: TypeReleve.MORTALITE } & MortaliteFields)
  | ({ typeReleve: TypeReleve.ALIMENTATION } & AlimentationFields)
  | ({ typeReleve: TypeReleve.QUALITE_EAU } & QualiteEauFields)
  | ({ typeReleve: TypeReleve.COMPTAGE } & ComptageFields)
  | ({ typeReleve: TypeReleve.OBSERVATION } & ObservationFields)
  | ({ typeReleve: TypeReleve.RENOUVELLEMENT } & RenouvellementFields)
  | { typeReleve: "" };

export interface ActivitePlanifiee {
  id: string;
  titre: string;
  dateDebut: string | Date;
  statut: string;
  releveId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inverse de ACTIVITE_RELEVE_TYPE_MAP : TypeReleve → TypeActivite compatible */
const RELEVE_ACTIVITE_TYPE_MAP: Partial<Record<string, TypeActivite>> = {};
for (const [typeActivite, typeReleve] of Object.entries(ACTIVITE_RELEVE_TYPE_MAP)) {
  if (typeReleve) {
    RELEVE_ACTIVITE_TYPE_MAP[typeReleve] = typeActivite as TypeActivite;
  }
}

function nowDatetimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function getEmptyFields(type: string): TypedFormFields {
  switch (type) {
    case TypeReleve.BIOMETRIE:
      return { typeReleve: TypeReleve.BIOMETRIE, poidsMoyen: "", tailleMoyenne: "", echantillonCount: "" };
    case TypeReleve.MORTALITE:
      return { typeReleve: TypeReleve.MORTALITE, nombreMorts: "", causeMortalite: "" };
    case TypeReleve.ALIMENTATION:
      return { typeReleve: TypeReleve.ALIMENTATION, quantiteAliment: "", typeAliment: "", frequenceAliment: "", tauxRefus: "", comportementAlim: "" };
    case TypeReleve.QUALITE_EAU:
      return { typeReleve: TypeReleve.QUALITE_EAU, temperature: "", ph: "", oxygene: "", ammoniac: "" };
    case TypeReleve.COMPTAGE:
      return { typeReleve: TypeReleve.COMPTAGE, nombreCompte: "", methodeComptage: "" };
    case TypeReleve.OBSERVATION:
      return { typeReleve: TypeReleve.OBSERVATION, description: "" };
    case TypeReleve.RENOUVELLEMENT:
      return { typeReleve: TypeReleve.RENOUVELLEMENT, pourcentageRenouvellement: "", volumeRenouvele: "", nombreRenouvellements: "1" };
    default:
      return { typeReleve: "" };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseReleveFormProps {
  produits: ProduitOption[];
}

export function useReleveForm({ produits }: UseReleveFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activiteService = useActiviteService();
  const releveService = useReleveService();
  const queryClient = useQueryClient();
  const t = useTranslations("releves");

  const initialActiviteId = searchParams.get("activiteId") ?? "";
  const initialTypeReleve = searchParams.get("typeReleve") ?? "";
  const initialBacId = searchParams.get("bacId") ?? "";
  const initialVagueId = searchParams.get("vagueId") ?? "";
  const isFromActivite = Boolean(initialActiviteId);

  const [vagueId, setVagueId] = useState(initialVagueId);
  const [bacId, setBacId] = useState(initialBacId);
  const [typeReleve, setTypeReleve] = useState(initialTypeReleve);
  const [releveDate, setReleveDate] = useState(nowDatetimeLocal);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consommations, setConsommations] = useState<ConsommationLine[]>([]);
  const [activiteId, setActiviteId] = useState(initialActiviteId);
  const [activitesPlanifiees, setActivitesPlanifiees] = useState<ActivitePlanifiee[]>([]);
  const [loadingActivites, setLoadingActivites] = useState(false);
  const [fields, setFields] = useState<TypedFormFields>(() => getEmptyFields(initialTypeReleve));

  const { data: bacsData, isLoading: loadingBacs } = useBacsList(
    vagueId ? { vagueId } : undefined,
    { enabled: !!vagueId }
  );

  const bacs = useMemo(
    () => (bacsData ?? []).filter((b: BacResponse) => b.vagueId === vagueId),
    [bacsData, vagueId]
  );

  const produitsByCategorie = useMemo(
    () => ({
      aliment: produits.filter((p) => p.categorie === CategorieProduit.ALIMENT),
      intrant: produits.filter((p) => p.categorie === CategorieProduit.INTRANT),
    }),
    [produits]
  );

  useEffect(() => {
    if (!isFromActivite) setBacId("");
  }, [vagueId, isFromActivite]);

  useEffect(() => {
    setFields(getEmptyFields(typeReleve));
    setConsommations([]);
    if (!isFromActivite) setActiviteId("");
  }, [typeReleve, isFromActivite]);

  useEffect(() => {
    setActivitesPlanifiees([]);
    if (!isFromActivite) setActiviteId("");
    if (!vagueId || !typeReleve) return;
    const typeActiviteCompat = RELEVE_ACTIVITE_TYPE_MAP[typeReleve];
    if (!typeActiviteCompat) return;
    setLoadingActivites(true);
    activiteService.list({ vagueId, typeActivite: typeActiviteCompat }).then((result) => {
      if (result.ok && result.data) {
        const compatibles = (result.data.data ?? []).filter(
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
  }, [vagueId, typeReleve, isFromActivite, activiteService]);

  const updateField = useCallback((field: string, value: string) => {
    setFields((prev) => {
      if (prev.typeReleve === "") return prev;
      return { ...prev, [field]: value } as TypedFormFields;
    });
  }, []);

  const handleVagueChange = useCallback((val: string) => setVagueId(val), []);
  const handleBacChange = useCallback((val: string) => setBacId(val), []);
  const handleTypeReleveChange = useCallback((val: string) => setTypeReleve(val), []);
  const handleRelEveDateChange = useCallback((val: string) => setReleveDate(val), []);
  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value), []);
  const handleActiviteChange = useCallback((val: string) => setActiviteId(val === "__auto__" ? "" : val), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateReleveForm(vagueId, bacId, typeReleve, fields, t);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    const dto = buildReleveDTO({ vagueId, bacId, notes, activiteId, releveDate, fields, consommations });
    const result = await releveService.create(dto);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.detail(vagueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      router.push(`/vagues/${vagueId}`);
    }
  }

  return {
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
    produitsByCategorie,
    isFromActivite,
    initialTypeReleve,
    initialBacId,
    handleVagueChange,
    handleBacChange,
    handleTypeReleveChange,
    handleRelEveDateChange,
    handleNotesChange,
    handleActiviteChange,
    updateField,
    setConsommations,
    handleSubmit,
    releveActiviteTypeMap: RELEVE_ACTIVITE_TYPE_MAP,
  };
}
