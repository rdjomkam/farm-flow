import { Pencil } from "lucide-react";
import type { ReleveModificationWithUser } from "@/types";

/** Labels lisibles pour les noms de champs techniques */
const champLabels: Record<string, string> = {
  poidsMoyen:       "Poids moyen (g)",
  tailleMoyenne:    "Taille moyenne (cm)",
  echantillonCount: "Echantillons",
  nombreMorts:      "Nombre de morts",
  causeMortalite:   "Cause mortalite",
  quantiteAliment:  "Quantite aliment (kg)",
  typeAliment:      "Type aliment",
  frequenceAliment: "Frequence aliment",
  temperature:      "Temperature (C)",
  ph:               "pH",
  oxygene:          "Oxygene (mg/L)",
  ammoniac:         "Ammoniac (mg/L)",
  nombreCompte:     "Nombre compte",
  methodeComptage:  "Methode comptage",
  description:      "Description",
  notes:            "Notes",
  consommations:    "Consommations",
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "a l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return formatDate(date);
}

interface ReleveModificationsListProps {
  modifications: ReleveModificationWithUser[];
}

export function ReleveModificationsList({ modifications }: ReleveModificationsListProps) {
  if (modifications.length === 0) return null;

  // Grouper par raison + createdAt proche (meme operation de modification)
  // Simplification : on affiche chaque ligne individuellement mais groupee visuellement par raison
  const groupes = modifications.reduce<{ raison: string; user: { id: string; name: string }; createdAt: Date | string; champs: ReleveModificationWithUser[] }[]>(
    (acc, mod) => {
      const last = acc[acc.length - 1];
      if (
        last &&
        last.raison === mod.raison &&
        last.user.id === mod.user.id &&
        Math.abs(new Date(last.createdAt).getTime() - new Date(mod.createdAt).getTime()) < 5000
      ) {
        last.champs.push(mod);
      } else {
        acc.push({
          raison: mod.raison,
          user: mod.user,
          createdAt: mod.createdAt,
          champs: [mod],
        });
      }
      return acc;
    },
    []
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Pencil className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Historique des modifications</h3>
      </div>
      <div className="flex flex-col gap-3">
        {groupes.map((groupe, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-background p-3 text-sm">
            {/* En-tete : utilisateur + date relative */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-foreground">{groupe.user.name}</span>
              <span className="text-xs text-muted-foreground" title={formatDate(groupe.createdAt)}>
                {formatRelativeDate(groupe.createdAt)}
              </span>
            </div>

            {/* Raison */}
            <p className="text-xs text-muted-foreground italic mb-2">
              Raison : &ldquo;{groupe.raison}&rdquo;
            </p>

            {/* Champs modifies */}
            <div className="flex flex-col gap-1">
              {groupe.champs.map((champ) => (
                <div key={champ.id} className="flex items-start gap-2 text-xs">
                  <span className="font-medium text-foreground min-w-0 shrink-0">
                    {champLabels[champ.champModifie] ?? champ.champModifie}
                  </span>
                  <span className="text-muted-foreground">:</span>
                  <span className="text-danger/80 line-through shrink-0">
                    {champ.ancienneValeur ?? "—"}
                  </span>
                  <span className="text-muted-foreground shrink-0">→</span>
                  <span className="text-success font-medium shrink-0">
                    {champ.nouvelleValeur ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
