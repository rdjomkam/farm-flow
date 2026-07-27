import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { BacEnDerive } from "@/types";
import {
  BACS_EN_DERIVE_LABELS,
  formatEcartSigne,
  formatPremiereDetection,
} from "@/lib/bacs-en-derive-constants";

/**
 * BacsEnDeriveSection — carte "Écarts détectés sur des bacs" du dashboard site.
 *
 * Sprint BD — Story BD.2 (ADR-051, ADR-048 section 9). Consomme
 * `getBacsEnDerive(siteId)` (query layer, déjà scopée siteId — R8) et se
 * contente d'afficher : elle n'effectue aucun accès Prisma direct.
 *
 * Règle produit (cadrage acté, ADR-051 section 2) : cette section ne
 * s'affiche QUE s'il existe au moins un bac concerné. Le cas 0 résultat ne
 * rend rien — pas d'état vide, pas de message rassurant.
 */
interface BacsEnDeriveSectionProps {
  bacsEnDerive: BacEnDerive[];
}

export function BacsEnDeriveSection({ bacsEnDerive }: BacsEnDeriveSectionProps) {
  if (bacsEnDerive.length === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {BACS_EN_DERIVE_LABELS.title}
      </h2>
      <p className="text-xs text-muted-foreground mb-2">{BACS_EN_DERIVE_LABELS.nuance}</p>
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {bacsEnDerive.map((b) => (
            <Link
              key={b.bacId}
              href={`/bacs/${b.bacId}`}
              className="flex min-h-11 flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {b.bacNom}
                    <span className="text-muted-foreground font-normal"> &mdash; {b.vagueCode}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatEcartSigne(b.ecart)}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 text-right">
                  {formatPremiereDetection(b.premiereDetectionLe)}
                </span>
              </div>
              <span className="text-xs font-medium text-primary">
                {BACS_EN_DERIVE_LABELS.lienFicheBac}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
