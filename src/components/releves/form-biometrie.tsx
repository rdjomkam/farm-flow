import { Input } from "@/components/ui/input";

interface FormBiometrieProps {
  values: { poidsMoyen: string; tailleMoyenne: string; echantillonCount: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormBiometrie({ values, onChange, errors }: FormBiometrieProps) {
  return (
    <>
      <Input
        id="poidsMoyen"
        label="Poids moyen (g)"
        type="number"
        min="0.1"
        step="0.1"
        value={values.poidsMoyen}
        onChange={(e) => onChange("poidsMoyen", e.target.value)}
        error={errors.poidsMoyen}
      />
      <Input
        id="tailleMoyenne"
        label="Taille moyenne (cm)"
        type="number"
        min="0.1"
        step="0.1"
        value={values.tailleMoyenne}
        onChange={(e) => onChange("tailleMoyenne", e.target.value)}
        error={errors.tailleMoyenne}
      />
      <Input
        id="echantillonCount"
        label="Nombre d'échantillons"
        type="number"
        min="1"
        value={values.echantillonCount}
        onChange={(e) => onChange("echantillonCount", e.target.value)}
        error={errors.echantillonCount}
      />
    </>
  );
}
