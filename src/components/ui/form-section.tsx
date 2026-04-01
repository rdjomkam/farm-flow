interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Identifiant optionnel transmis à la légende pour permettre aria-labelledby externe */
  id?: string;
}

export function FormSection({ title, description, children, id }: FormSectionProps) {
  const legendId = id ? `${id}-legend` : undefined;
  return (
    <fieldset className="space-y-3" aria-labelledby={legendId}>
      <legend id={legendId} className="flex flex-col gap-0.5 mb-1">
        <span className="text-sm font-semibold">{title}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </legend>
      <div className="rounded-xl bg-surface-2 p-4 space-y-3">
        {children}
      </div>
    </fieldset>
  );
}
