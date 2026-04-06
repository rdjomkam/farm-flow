import VagueRelevesPage from "@/components/pages/vague-releves-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return VagueRelevesPage({ params, searchParams });
}
