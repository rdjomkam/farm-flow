"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Receipt, Calendar, ArrowUpRight, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { CategorieDepense, StatutDepense } from "@/types";

// ---------------------------------------------------------------------------
// Labels & variants
// ---------------------------------------------------------------------------

const statutLabels: Record<StatutDepense, string> = {
  [StatutDepense.NON_PAYEE]: "Non payee",
  [StatutDepense.PAYEE_PARTIELLEMENT]: "Partiellement payee",
  [StatutDepense.PAYEE]: "Payee",
};

const statutVariants: Record<
  StatutDepense,
  "default" | "warning" | "info" | "en_cours"
> = {
  [StatutDepense.NON_PAYEE]: "warning",
  [StatutDepense.PAYEE_PARTIELLEMENT]: "info",
  [StatutDepense.PAYEE]: "en_cours",
};

const categorieLabels: Record<CategorieDepense, string> = {
  [CategorieDepense.ALIMENT]: "Aliment",
  [CategorieDepense.INTRANT]: "Intrant",
  [CategorieDepense.EQUIPEMENT]: "Equipement",
  [CategorieDepense.ELECTRICITE]: "Electricite",
  [CategorieDepense.EAU]: "Eau",
  [CategorieDepense.LOYER]: "Loyer",
  [CategorieDepense.SALAIRE]: "Salaire",
  [CategorieDepense.TRANSPORT]: "Transport",
  [CategorieDepense.VETERINAIRE]: "Veterinaire",
  [CategorieDepense.REPARATION]: "Reparation",
  [CategorieDepense.INVESTISSEMENT]: "Investissement",
  [CategorieDepense.AUTRE]: "Autre",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepenseData {
  id: string;
  numero: string;
  description: string;
  categorieDepense: string;
  montantTotal: number;
  montantPaye: number;
  statut: string;
  date: string;
  dateEcheance: string | null;
  commande: { id: string; numero: string } | null;
  vague: { id: string; code: string } | null;
  _count: { paiements: number };
}

interface Props {
  depenses: DepenseData[];
  canManage: boolean;
  canPay: boolean;
  templatesActifsCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(montant: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(montant)) + " FCFA";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepensesListClient({ depenses, canManage, templatesActifsCount = 0 }: Props) {
  const [categorieFilter, setCategorieFilter] = useState<string>("TOUTES");
  const [activeTab, setActiveTab] = useState("toutes");

  function handleCategorieChange(value: string) {
    setCategorieFilter(value);
    setActiveTab("toutes");
  }

  const depensesFiltrees =
    categorieFilter === "TOUTES"
      ? depenses
      : depenses.filter((d) => d.categorieDepense === categorieFilter);

  const nonPayees = depensesFiltrees.filter(
    (d) => d.statut === StatutDepense.NON_PAYEE
  );
  const partiellesPay = depensesFiltrees.filter(
    (d) => d.statut === StatutDepense.PAYEE_PARTIELLEMENT
  );
  const payees = depensesFiltrees.filter(
    (d) => d.statut === StatutDepense.PAYEE
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Acces rapide aux recurrentes */}
      {templatesActifsCount > 0 && (
        <Link href="/depenses/recurrentes">
          <Card className="bg-muted/40 border-dashed cursor-pointer hover:bg-muted/60 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span>
                  {templatesActifsCount} depense{templatesActifsCount !== 1 ? "s" : ""} recurrente{templatesActifsCount !== 1 ? "s" : ""} configuree{templatesActifsCount !== 1 ? "s" : ""}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 max-w-xs">
          <Select
            value={categorieFilter}
            onValueChange={handleCategorieChange}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Toutes categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TOUTES">Toutes categories</SelectItem>
              {Object.values(CategorieDepense).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categorieLabels[cat as CategorieDepense]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <Link href="/depenses/recurrentes">
              <Button variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Recurrentes</span>
              </Button>
            </Link>
          )}
          {canManage && (
            <Link href="/depenses/nouvelle">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nouvelle
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs par statut */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="toutes">
            Toutes ({depensesFiltrees.length})
          </TabsTrigger>
          <TabsTrigger value="non_payees">
            Dues ({nonPayees.length})
          </TabsTrigger>
          <TabsTrigger value="partielles">
            Partiel ({partiellesPay.length})
          </TabsTrigger>
          <TabsTrigger value="payees">
            Payees ({payees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toutes" className="mt-3">
          <DepensesList depenses={depensesFiltrees} />
        </TabsContent>
        <TabsContent value="non_payees" className="mt-3">
          <DepensesList depenses={nonPayees} />
        </TabsContent>
        <TabsContent value="partielles" className="mt-3">
          <DepensesList depenses={partiellesPay} />
        </TabsContent>
        <TabsContent value="payees" className="mt-3">
          <DepensesList depenses={payees} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DepensesList sub-component
// ---------------------------------------------------------------------------

function DepensesList({ depenses }: { depenses: DepenseData[] }) {
  if (depenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Receipt className="h-10 w-10 opacity-30" />
        <p className="text-sm">Aucune depense</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {depenses.map((dep) => (
        <DepenseCard key={dep.id} depense={dep} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DepenseCard sub-component
// ---------------------------------------------------------------------------

function DepenseCard({ depense }: { depense: DepenseData }) {
  const statut = depense.statut as StatutDepense;
  const categorie = depense.categorieDepense as CategorieDepense;
  const resteAPayer = depense.montantTotal - depense.montantPaye;
  const pctPaye =
    depense.montantTotal > 0
      ? Math.min(
          100,
          Math.round((depense.montantPaye / depense.montantTotal) * 100)
        )
      : 0;

  return (
    <Link href={`/depenses/${depense.id}`}>
      <Card className="hover:ring-2 hover:ring-primary/20 transition-all">
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {depense.numero}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {depense.description}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={statutVariants[statut]}>
                {statutLabels[statut]}
              </Badge>
              <Badge variant="default" className="text-xs">
                {categorieLabels[categorie]}
              </Badge>
            </div>
          </div>

          {/* Montants */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Total : </span>
              <span className="font-semibold">
                {formatMontant(depense.montantTotal)}
              </span>
            </div>
            {statut !== StatutDepense.PAYEE && (
              <div className="text-right">
                <span className="text-muted-foreground text-xs">Reste : </span>
                <span className="font-semibold text-warning">
                  {formatMontant(resteAPayer)}
                </span>
              </div>
            )}
          </div>

          {/* Barre de progression */}
          {statut !== StatutDepense.NON_PAYEE && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pctPaye}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {pctPaye}%
              </span>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(depense.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              {depense.commande && (
                <span className="truncate max-w-[120px]">
                  {depense.commande.numero}
                </span>
              )}
              {depense.vague && (
                <span className="truncate max-w-[80px]">
                  {depense.vague.code}
                </span>
              )}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
