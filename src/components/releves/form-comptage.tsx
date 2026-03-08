import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { MethodeComptage } from "@/types";

const methodeLabels: Record<MethodeComptage, string> = {
  [MethodeComptage.DIRECT]: "Direct",
  [MethodeComptage.ESTIMATION]: "Estimation",
  [MethodeComptage.ECHANTILLONNAGE]: "Échantillonnage",
};

interface FormComptageProps {
  values: { nombreCompte: string; methodeComptage: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormComptage({ values, onChange, errors }: FormComptageProps) {
  return (
    <>
      <Input
        id="nombreCompte"
        label="Nombre de poissons comptés"
        type="number"
        min="0"
        value={values.nombreCompte}
        onChange={(e) => onChange("nombreCompte", e.target.value)}
        error={errors.nombreCompte}
      />
      <Select value={values.methodeComptage} onValueChange={(v) => onChange("methodeComptage", v)}>
        <SelectTrigger label="Méthode de comptage" error={errors.methodeComptage}>
          <SelectValue placeholder="Sélectionner une méthode" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(MethodeComptage).map((m) => (
            <SelectItem key={m} value={m}>
              {methodeLabels[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
