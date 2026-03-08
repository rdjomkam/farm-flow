import { Header } from "@/components/layout/header";
import { BacsListClient } from "@/components/bacs/bacs-list-client";
import { getBacs } from "@/lib/queries/bacs";

export default async function BacsPage() {
  const bacs = await getBacs();

  return (
    <>
      <Header title="Bacs" />
      <BacsListClient bacs={bacs} />
    </>
  );
}
