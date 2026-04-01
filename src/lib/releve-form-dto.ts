import { TypeReleve } from "@/types";
import type { CreateReleveDTO, CauseMortalite, TypeAliment, ComportementAlimentaire, MethodeComptage } from "@/types";
import type { TypedFormFields } from "@/hooks/use-releve-form";
import type { ConsommationLine } from "@/components/releves/consommation-fields";

interface BuildDTOParams {
  vagueId: string;
  bacId: string;
  notes: string;
  activiteId: string;
  releveDate: string;
  fields: TypedFormFields;
  consommations: ConsommationLine[];
}

type WithConsommations<T> = T & { consommations?: { produitId: string; quantite: number }[] };

function attachConsommations<T extends object>(dto: T, consommations: ConsommationLine[]): WithConsommations<T> {
  const validConsos = consommations.filter((c) => c.produitId && c.quantite && Number(c.quantite) > 0);
  if (validConsos.length === 0) return dto;
  return {
    ...dto,
    consommations: validConsos.map((c) => ({ produitId: c.produitId, quantite: Number(c.quantite) })),
  };
}

/** Construit le DTO typé à partir de l'état du formulaire. Lance une erreur si le type est inconnu. */
export function buildReleveDTO({
  vagueId,
  bacId,
  notes,
  activiteId,
  releveDate,
  fields,
  consommations,
}: BuildDTOParams): CreateReleveDTO {
  const base = {
    vagueId,
    bacId,
    ...(notes.trim() && { notes: notes.trim() }),
    ...(activiteId && { activiteId }),
    date: new Date(releveDate).toISOString(),
  };

  if (fields.typeReleve === TypeReleve.BIOMETRIE) {
    return attachConsommations({
      ...base,
      typeReleve: TypeReleve.BIOMETRIE as const,
      poidsMoyen: Number(fields.poidsMoyen),
      echantillonCount: Number(fields.echantillonCount),
      ...(fields.tailleMoyenne && { tailleMoyenne: Number(fields.tailleMoyenne) }),
    }, consommations);
  }
  if (fields.typeReleve === TypeReleve.MORTALITE) {
    return attachConsommations({
      ...base,
      typeReleve: TypeReleve.MORTALITE as const,
      nombreMorts: Number(fields.nombreMorts),
      causeMortalite: fields.causeMortalite as CauseMortalite,
    }, consommations);
  }
  if (fields.typeReleve === TypeReleve.ALIMENTATION) {
    return attachConsommations({
      ...base,
      typeReleve: TypeReleve.ALIMENTATION as const,
      quantiteAliment: Number(fields.quantiteAliment),
      typeAliment: fields.typeAliment as TypeAliment,
      frequenceAliment: Number(fields.frequenceAliment),
      ...(fields.tauxRefus && { tauxRefus: Number(fields.tauxRefus) }),
      ...(fields.comportementAlim && { comportementAlim: fields.comportementAlim as ComportementAlimentaire }),
    }, consommations);
  }
  if (fields.typeReleve === TypeReleve.QUALITE_EAU) {
    return attachConsommations({
      ...base,
      typeReleve: TypeReleve.QUALITE_EAU as const,
      ...(fields.temperature && { temperature: Number(fields.temperature) }),
      ...(fields.ph && { ph: Number(fields.ph) }),
      ...(fields.oxygene && { oxygene: Number(fields.oxygene) }),
      ...(fields.ammoniac && { ammoniac: Number(fields.ammoniac) }),
    }, consommations);
  }
  if (fields.typeReleve === TypeReleve.COMPTAGE) {
    return attachConsommations({
      ...base,
      typeReleve: TypeReleve.COMPTAGE as const,
      nombreCompte: Number(fields.nombreCompte),
      methodeComptage: fields.methodeComptage as MethodeComptage,
    }, consommations);
  }
  if (fields.typeReleve === TypeReleve.OBSERVATION) {
    return {
      ...base,
      typeReleve: TypeReleve.OBSERVATION as const,
      description: fields.description.trim(),
    };
  }
  if (fields.typeReleve === TypeReleve.RENOUVELLEMENT) {
    return {
      ...base,
      typeReleve: TypeReleve.RENOUVELLEMENT as const,
      ...(fields.pourcentageRenouvellement && { pourcentageRenouvellement: Number(fields.pourcentageRenouvellement) }),
      ...(fields.volumeRenouvele && { volumeRenouvele: Number(fields.volumeRenouvele) }),
      ...(fields.nombreRenouvellements && { nombreRenouvellements: Number(fields.nombreRenouvellements) }),
    };
  }
  throw new Error(`Type de relevé non reconnu : ${String(fields.typeReleve)}`);
}
