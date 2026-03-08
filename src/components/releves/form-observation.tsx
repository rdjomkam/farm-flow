import { Textarea } from "@/components/ui/textarea";

interface FormObservationProps {
  values: { description: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormObservation({ values, onChange, errors }: FormObservationProps) {
  return (
    <Textarea
      id="description"
      label="Description"
      rows={4}
      placeholder="Décrivez votre observation..."
      value={values.description}
      onChange={(e) => onChange("description", e.target.value)}
      error={errors.description}
    />
  );
}
