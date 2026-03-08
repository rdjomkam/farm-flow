import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { TypeAliment } from "@/types";

const alimentLabels: Record<TypeAliment, string> = {
  [TypeAliment.ARTISANAL]: "Artisanal",
  [TypeAliment.COMMERCIAL]: "Commercial",
  [TypeAliment.MIXTE]: "Mixte",
};

interface FormAlimentationProps {
  values: { quantiteAliment: string; typeAliment: string; frequenceAliment: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormAlimentation({ values, onChange, errors }: FormAlimentationProps) {
  return (
    <>
      <Input
        id="quantiteAliment"
        label="Quantité d'aliment (kg)"
        type="number"
        min="0.01"
        step="0.01"
        value={values.quantiteAliment}
        onChange={(e) => onChange("quantiteAliment", e.target.value)}
        error={errors.quantiteAliment}
      />
      <Select value={values.typeAliment} onValueChange={(v) => onChange("typeAliment", v)}>
        <SelectTrigger label="Type d'aliment" error={errors.typeAliment}>
          <SelectValue placeholder="Sélectionner un type" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(TypeAliment).map((t) => (
            <SelectItem key={t} value={t}>
              {alimentLabels[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id="frequenceAliment"
        label="Fréquence (fois/jour)"
        type="number"
        min="1"
        value={values.frequenceAliment}
        onChange={(e) => onChange("frequenceAliment", e.target.value)}
        error={errors.frequenceAliment}
      />
    </>
  );
}
