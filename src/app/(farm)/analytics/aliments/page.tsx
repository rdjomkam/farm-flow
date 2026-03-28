import AnalyticsAlimentsPage from "@/components/pages/analytics-aliments-page";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AnalyticsAlimentsPage searchParams={searchParams} />;
}
