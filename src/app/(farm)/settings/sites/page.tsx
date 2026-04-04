import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { getServerSession } from "@/lib/auth";
import { getUserSites } from "@/lib/queries/sites";
import { SitesListClient } from "@/components/sites/sites-list-client";
import { Role } from "@/types";

export default async function SitesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settings.page");
  const sites = await getUserSites(session.userId);

  const sitesData = sites.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    isActive: s.isActive,
    isBlocked: s.isBlocked,
    memberCount: s._count.members,
    bacCount: s._count.bacs,
    vagueCount: s._count.vagues,
    createdAt: s.createdAt,
  }));

  // isOwner : l'utilisateur est propriétaire d'au moins un site
  const isOwner = sites.some((s) => s.ownerId === session.userId);

  return (
    <>
      <Header title={t("mySites")} />
      <div className="p-4">
        <SitesListClient
          sites={sitesData}
          activeSiteId={session.activeSiteId}
          canCreate={session.role === Role.ADMIN}
          isOwner={isOwner}
        />
      </div>
    </>
  );
}
