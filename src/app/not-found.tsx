import Link from "next/link";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <FishLoader size="lg" />
      <div className="text-7xl font-bold" style={{ color: "var(--primary)", opacity: 0.15 }}>
        404
      </div>
      <div className="max-w-xs">
        <h1 className="text-xl font-semibold text-foreground">
          Page introuvable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou a ete deplacee.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
