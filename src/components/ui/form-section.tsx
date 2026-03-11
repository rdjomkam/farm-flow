interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="flex flex-col gap-0.5 mb-1">
        <span className="text-sm font-semibold">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </legend>
      <div className="rounded-xl bg-surface-2 p-4 space-y-3">
        {children}
      </div>
    </fieldset>
  );
}
