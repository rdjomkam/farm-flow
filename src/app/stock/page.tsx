import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Package, AlertTriangle, Truck, ShoppingCart } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getProduits, getProduitsEnAlerte } from "@/lib/queries/produits";
import { getFournisseurs } from "@/lib/queries/fournisseurs";
import { getCommandes } from "@/lib/queries/commandes";
import { StatutCommande, Permission } from "@/types";

export default async function StockPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const [permissions, t, produits, alertes, fournisseurs, commandes] = await Promise.all([
    checkPagePermission(session, Permission.STOCK_VOIR),
    getTranslations("stock"),
    getProduits(session.activeSiteId),
    getProduitsEnAlerte(session.activeSiteId),
    getFournisseurs(session.activeSiteId),
    getCommandes(session.activeSiteId),
  ]);
  if (!permissions) return <AccessDenied />;

  const commandesEnCours = commandes.filter(
    (c) => c.statut === StatutCommande.BROUILLON || c.statut === StatutCommande.ENVOYEE
  );

  const sections = [
    {
      href: "/stock/produits",
      label: t("sections.produits"),
      description: t("sections.produitsDesc", { count: produits.length }),
      icon: Package,
      color: "text-accent-blue",
      bgColor: "bg-accent-blue-muted",
    },
    {
      href: "/stock/fournisseurs",
      label: t("sections.fournisseurs"),
      description: t("sections.fournisseursDesc", { count: fournisseurs.length }),
      icon: Truck,
      color: "text-accent-purple",
      bgColor: "bg-accent-purple-muted",
    },
    {
      href: "/stock/commandes",
      label: t("sections.commandes"),
      description: t("sections.commandesDesc", { count: commandesEnCours.length }),
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <>
      <Header title={t("title")} />
      <div className="flex flex-col gap-4 p-4">
        {/* Stock alerts */}
        {alertes.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="font-semibold text-sm">
                  {t("alertes.title", { count: alertes.length })}
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {alertes.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/stock/produits/${p.id}`}
                    className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
                  >
                    <span className="truncate">{p.nom}</span>
                    <Badge variant="warning">
                      {p.stockActuel} / {p.seuilAlerte} {p.unite}
                    </Badge>
                  </Link>
                ))}
                {alertes.length > 5 && (
                  <Link
                    href="/stock/produits?alerte=true"
                    className="text-xs text-primary hover:underline"
                  >
                    {t("alertes.voirTout", { count: alertes.length })}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <Card className="hover:ring-2 hover:ring-primary/20 transition-all">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${section.bgColor} shrink-0`}>
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
