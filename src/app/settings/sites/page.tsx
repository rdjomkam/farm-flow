import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession } from "@/lib/auth";
import { getUserSites } from "@/lib/queries/sites";
import { SitesListClient } from "@/components/sites/sites-list-client";
import { Role } from "@/types";

export default async function SitesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const sites = await getUserSites(session.userId);

  const sitesData = sites.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    isActive: s.isActive,
    memberCount: s._count.members,
    bacCount: s._count.bacs,
    vagueCount: s._count.vagues,
    createdAt: s.createdAt,
  }));

  return (
    <>
      <Header title="Mes sites" />
      <div className="p-4">
        <SitesListClient
          sites={sitesData}
          activeSiteId={session.activeSiteId}
          canCreate={session.role === Role.ADMIN}
        />
      </div>
    </>
  );
}
