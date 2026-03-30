"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FarmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[FarmError]", error);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger text-2xl">
        !
      </div>
      <div>
        <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quelque chose s&apos;est mal passe. Veuillez reessayer.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="secondary">
          Reessayer
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
