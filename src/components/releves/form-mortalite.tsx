import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CauseMortalite } from "@/types";

const causeLabels: Record<CauseMortalite, string> = {
  [CauseMortalite.MALADIE]: "Maladie",
  [CauseMortalite.QUALITE_EAU]: "Qualité de l'eau",
  [CauseMortalite.STRESS]: "Stress",
  [CauseMortalite.PREDATION]: "Prédation",
  [CauseMortalite.CANNIBALISME]: "Cannibalisme",
  [CauseMortalite.INCONNUE]: "Inconnue",
  [CauseMortalite.AUTRE]: "Autre",
};

interface FormMortaliteProps {
  values: { nombreMorts: string; causeMortalite: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormMortalite({ values, onChange, errors }: FormMortaliteProps) {
  return (
    <>
      <Input
        id="nombreMorts"
        label="Nombre de morts"
        type="number"
        min="0"
        value={values.nombreMorts}
        onChange={(e) => onChange("nombreMorts", e.target.value)}
        error={errors.nombreMorts}
      />
      <Select value={values.causeMortalite} onValueChange={(v) => onChange("causeMortalite", v)}>
        <SelectTrigger label="Cause de mortalité" error={errors.causeMortalite}>
          <SelectValue placeholder="Sélectionner une cause" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(CauseMortalite).map((c) => (
            <SelectItem key={c} value={c}>
              {causeLabels[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
