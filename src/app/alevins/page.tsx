import type { ComponentType } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Egg, Users, Baby, ArrowRightLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getReproducteurs } from "@/lib/queries/reproducteurs";
import { getPontes } from "@/lib/queries/pontes";
import { getLotsAlevins } from "@/lib/queries/lots-alevins";
import {
  StatutReproducteur,
  StatutPonte,
  StatutLotAlevins,
  Permission,
} from "@/types";

export default async function AlevinsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const [reproducteurs, pontes, lots] = await Promise.all([
    getReproducteurs(session.activeSiteId),
    getPontes(session.activeSiteId),
    getLotsAlevins(session.activeSiteId),
  ]);

  const reproducteursActifs = reproducteurs.filter(
    (r) => r.statut === StatutReproducteur.ACTIF
  );
  const pontesEnCours = pontes.filter(
    (p) => p.statut === StatutPonte.EN_COURS
  );
  const lotsEnElevage = lots.filter(
    (l) =>
      l.statut === StatutLotAlevins.EN_ELEVAGE ||
      l.statut === StatutLotAlevins.EN_INCUBATION
  );
  const dernierTransfert = lots
    .filter((l) => l.statut === StatutLotAlevins.TRANSFERE)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

  const kpis: {
    label: string;
    value: string | number;
    total?: number;
    icon: ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  }[] = [
    {
      label: "Reproducteurs actifs",
      value: reproducteursActifs.length,
      total: reproducteurs.length,
      icon: Users,
      color: "text-accent-green",
      bgColor: "bg-accent-green-muted",
    },
    {
      label: "Pontes en cours",
      value: pontesEnCours.length,
      total: pontes.length,
      icon: Egg,
      color: "text-accent-yellow",
      bgColor: "bg-accent-yellow-muted",
    },
    {
      label: "Lots en elevage",
      value: lotsEnElevage.length,
      total: lots.length,
      icon: Baby,
      color: "text-accent-blue",
      bgColor: "bg-accent-blue-muted",
    },
    {
      label: "Dernier transfert",
      value: dernierTransfert
        ? new Date(dernierTransfert.updatedAt).toLocaleDateString("fr-FR")
        : "—",
      icon: ArrowRightLeft,
      color: "text-accent-purple",
      bgColor: "bg-accent-purple-muted",
    },
  ];

  const sections = [
    {
      href: "/alevins/reproducteurs",
      label: "Reproducteurs",
      description: `${reproducteurs.length} reproducteur${reproducteurs.length > 1 ? "s" : ""}`,
      icon: Users,
      color: "text-accent-green",
      bgColor: "bg-accent-green-muted",
    },
    {
      href: "/alevins/pontes",
      label: "Pontes",
      description: `${pontes.length} ponte${pontes.length > 1 ? "s" : ""}`,
      icon: Egg,
      color: "text-accent-yellow",
      bgColor: "bg-accent-yellow-muted",
    },
    {
      href: "/alevins/lots",
      label: "Lots d'alevins",
      description: `${lots.length} lot${lots.length > 1 ? "s" : ""}`,
      icon: Baby,
      color: "text-accent-blue",
      bgColor: "bg-accent-blue-muted",
    },
  ];

  return (
    <>
      <Header title="Production Alevins" />
      <div className="flex flex-col gap-4 p-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bgColor} shrink-0`}
                    >
                      <Icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {kpi.label}
                    {"total" in kpi && kpi.total !== undefined && (
                      <span className="ml-1 text-muted-foreground/70">
                        / {kpi.total}
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Navigation cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <Card className="hover:ring-2 hover:ring-primary/20 transition-all">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${section.bgColor} shrink-0`}
                    >
                      <Icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{section.label}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {section.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
