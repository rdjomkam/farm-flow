import { Header } from "@/components/layout/header";
import { ReleveFormClient } from "@/components/releves/releve-form-client";
import { getVagues } from "@/lib/queries/vagues";
import { StatutVague } from "@/types";

export default async function NouveauRelevePage() {
  const vaguesRaw = await getVagues({ statut: StatutVague.EN_COURS });

  const vagues = vaguesRaw.map((v) => ({
    id: v.id,
    code: v.code,
  }));

  return (
    <>
      <Header title="Nouveau relevé" />
      <div className="p-4">
        <ReleveFormClient vagues={vagues} />
      </div>
    </>
  );
}
