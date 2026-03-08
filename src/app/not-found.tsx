import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="text-5xl font-bold text-muted-foreground">404</div>
      <div>
        <h2 className="text-lg font-semibold">Page introuvable</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
      </div>
      <Button variant="secondary" asChild>
        <Link href="/">Retour au dashboard</Link>
      </Button>
    </div>
  );
}
