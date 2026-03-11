import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TypeReleve } from "@/types";

const typeLabels: Record<string, string> = {
  [TypeReleve.BIOMETRIE]: "Biometrie",
  [TypeReleve.MORTALITE]: "Mortalite",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualite eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
};

const typeColors: Record<string, string> = {
  [TypeReleve.BIOMETRIE]: "bg-accent-blue",
  [TypeReleve.MORTALITE]: "bg-accent-red",
  [TypeReleve.ALIMENTATION]: "bg-accent-green",
  [TypeReleve.QUALITE_EAU]: "bg-accent-cyan",
  [TypeReleve.COMPTAGE]: "bg-accent-purple",
  [TypeReleve.OBSERVATION]: "bg-accent-amber",
};

interface RecentActivityProps {
  releves: {
    id: string;
    typeReleve: string;
    date: Date;
    createdAt: Date;
    vague: { code: string } | null;
    bac: { nom: string } | null;
  }[];
}

export function RecentActivity({ releves }: RecentActivityProps) {
  if (releves.length === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Activite recente</h2>
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {releves.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn("h-2 w-2 rounded-full shrink-0", typeColors[r.typeReleve] || "bg-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {typeLabels[r.typeReleve] || r.typeReleve}
                  {r.vague && <span className="text-muted-foreground font-normal"> &mdash; {r.vague.code}</span>}
                </p>
                {r.bac && <p className="text-xs text-muted-foreground">Bac: {r.bac.nom}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
