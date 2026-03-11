import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <>
      <Header title="Acces refuse" />
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[60vh]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Acces refuse</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Vous n&apos;avez pas les permissions necessaires pour acceder a cette page.
          Contactez un administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
        <Link href="/">
          <Button>Retour au dashboard</Button>
        </Link>
      </div>
    </>
  );
}
