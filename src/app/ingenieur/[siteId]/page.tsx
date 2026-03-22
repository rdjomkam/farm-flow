import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Fish,
  HeartPulse,
  MessageSquare,
  Package,
  AlertTriangle,
  Clock,
  Plus,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IngenieurClientCharts } from "@/components/ingenieur/client-charts";
import ReactMarkdown from "react-markdown";
import { NoteDetailDialog } from "@/components/notes/note-detail-dialog";
import { NouvelleNoteDialog } from "@/components/ingenieur/nouvelle-note-dialog";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getClientIngenieurDetail } from "@/lib/queries/ingenieur";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { getNotes } from "@/lib/queries/notes";
import { Permission, StatutAlerte, StatutActivation, StatutVague, TypeReleve } from "@/types";
import { prisma } from "@/lib/db";
import { formatNum } from "@/lib/format";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function IngenieurClientDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.MONITORING_CLIENTS);
  if (!permissions) return <AccessDenied />;

  const { siteId: clientSiteId } = await params;

  // Charger le summary du client (verifie droits d'acces)
  const clientSummary = await getClientIngenieurDetail(session.activeSiteId, clientSiteId);
  if (!clientSummary) notFound();

  // Charger les vagues EN_COURS avec releves detailles pour les graphiques
  const vaguesDetail = await prisma.vague.findMany({
    where: {
      siteId: clientSiteId,
      statut: StatutVague.EN_COURS,
    },
    include: {
      releves: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          typeReleve: true,
          poidsMoyen: true,
          tailleMoyenne: true,
          nombreMorts: true,
          nombreCompte: true,
          notes: true,
        },
      },
      bacs: { select: { id: true, nom: true } },
    },
    orderBy: { dateDebut: "asc" },
  });

  // Charger les notifications actives du site client
  const alertesActives = await prisma.notification.findMany({
    where: {
      siteId: clientSiteId,
      statut: StatutAlerte.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Charger les notes (ingenieur vers client)
  const notes = await getNotes(session.activeSiteId, {
    clientSiteId,
  });

  // Serialiser pour les composants client
  const vaguesDetailSerialized = JSON.parse(JSON.stringify(vaguesDetail));
  const notesSerialized = JSON.parse(JSON.stringify(notes));
  const alertesSerialized = JSON.parse(JSON.stringify(alertesActives));
  const vaguesPourNotes = vaguesDetail.map((v) => ({ id: v.id, code: v.code }));

  // Fetch indicateurs complets par vague (SGR, FCR, biomasse, etc.)
  const indicateursParVague = await Promise.all(
    vaguesDetail.map((v) => getIndicateursVague(clientSiteId, v.id))
  );

  // Calculer les indicateurs par vague pour affichage serveur
  const vaguesAvecStats = vaguesDetail.map((vague, i) => {
    const biometries = vague.releves.filter(
      (r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null
    );
    const mortalites = vague.releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
    const totalMortalites = mortalites.reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
    const dernierePoidsMoyen = biometries.at(-1)?.poidsMoyen ?? null;
    const nombreVivants = vague.nombreInitial - totalMortalites;
    const tauxSurvie =
      vague.nombreInitial > 0
        ? Math.round((nombreVivants / vague.nombreInitial) * 10000) / 100
        : null;

    const joursEcoules = Math.floor(
      (new Date().getTime() - new Date(vague.dateDebut).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: vague.id,
      code: vague.code,
      dateDebut: vague.dateDebut,
      nombreInitial: vague.nombreInitial,
      nombreVivants,
      totalMortalites,
      tauxSurvie,
      dernierePoidsMoyen,
      joursEcoules,
      nombreBacs: vague.bacs.length,
      nombreReleves: vague.releves.length,
      sgr: indicateursParVague[i]?.sgr ?? null,
      fcr: indicateursParVague[i]?.fcr ?? null,
      biomasse: indicateursParVague[i]?.biomasse ?? null,
    };
  });

  return (
    <>
      <Header title={clientSummary.siteName}>
        <Link href="/ingenieur">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Retour</span>
          </Button>
        </Link>
      </Header>

      <div className="flex flex-col gap-6 p-4">

        {/* En-tete client */}
        <section className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-xl font-bold">{clientSummary.siteName}</h2>
              <p className="text-sm text-muted-foreground">{clientSummary.packNom}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  clientSummary.activationStatut === StatutActivation.ACTIVE
                    ? "en_cours"
                    : clientSummary.activationStatut === StatutActivation.EXPIREE
                    ? "annulee"
                    : "default"
                }
              >
                {clientSummary.activationStatut === StatutActivation.ACTIVE
                  ? "Pack actif"
                  : clientSummary.activationStatut === StatutActivation.EXPIREE
                  ? "Pack expire"
                  : "Pack suspendu"}
              </Badge>
              {clientSummary.necessiteAttention && (
                <Badge variant="annulee">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Attention requise
                </Badge>
              )}
            </div>
          </div>

          {/* Infos pack */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{clientSummary.activationCode}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Actif depuis le{" "}
                {new Date(clientSummary.dateActivation).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {clientSummary.dateExpiration && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Expire le{" "}
                  {new Date(clientSummary.dateExpiration).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Metriques rapides */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <HeartPulse className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground">Survie moy.</span>
              </div>
              <p
                className={`text-lg font-bold ${
                  clientSummary.survieMoyenne === null
                    ? "text-muted-foreground"
                    : clientSummary.survieMoyenne >= 90
                    ? "text-success"
                    : clientSummary.survieMoyenne >= 80
                    ? "text-accent-amber"
                    : "text-danger"
                }`}
              >
                {clientSummary.survieMoyenne !== null
                  ? `${clientSummary.survieMoyenne}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Fish className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Vagues</span>
              </div>
              <p className="text-lg font-bold">
                {clientSummary.vaguesEnCours}
                <span className="text-xs font-normal text-muted-foreground ml-1">en cours</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <span className="text-xs text-muted-foreground">Alertes</span>
              </div>
              <p
                className={`text-lg font-bold ${
                  clientSummary.alertesActives > 0 ? "text-danger" : "text-muted-foreground"
                }`}
              >
                {clientSummary.alertesActives}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Messages</span>
              </div>
              <p
                className={`text-lg font-bold ${
                  clientSummary.notesNonLues > 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {clientSummary.notesNonLues}
                <span className="text-xs font-normal text-muted-foreground ml-1">non lu{clientSummary.notesNonLues > 1 ? "s" : ""}</span>
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Alertes actives */}
        {alertesSerialized.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Alertes actives ({alertesSerialized.length})
            </h2>
            <div className="flex flex-col gap-2">
              {alertesSerialized.map((alerte: (typeof alertesSerialized)[number]) => (
                <Card key={alerte.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-danger bg-danger/10">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{alerte.titre}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {alerte.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alerte.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {alertesSerialized.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm text-success font-medium">Aucune alerte active pour ce client.</p>
          </div>
        )}

        {/* Vagues en cours — fiches */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Vagues en cours ({vaguesAvecStats.length})
          </h2>

          {vaguesAvecStats.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center p-4">
                <Fish className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Aucune vague en cours.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {vaguesAvecStats.map((vague) => (
                <Link key={vague.id} href={`/ingenieur/${clientSiteId}/vagues/${vague.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{vague.code}</CardTitle>
                        <Badge variant="en_cours">En cours</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-0">
                      <div>
                        <p className="text-xs text-muted-foreground">Debut</p>
                        <p className="text-sm font-medium">
                          {new Date(vague.dateDebut).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Jour</p>
                        <p className="text-sm font-medium">J{vague.joursEcoules}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vivants / Initial</p>
                        <p className="text-sm font-medium">
                          {vague.nombreVivants} / {vague.nombreInitial}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Survie</p>
                        <p
                          className={`text-sm font-bold ${
                            vague.tauxSurvie === null
                              ? "text-muted-foreground"
                              : vague.tauxSurvie >= 90
                              ? "text-success"
                              : vague.tauxSurvie >= 80
                              ? "text-accent-amber"
                              : "text-danger"
                          }`}
                        >
                          {formatNum(vague.tauxSurvie, 1, "%")}
                        </p>
                      </div>
                      {vague.dernierePoidsMoyen !== null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Poids moy.</p>
                          <p className="text-sm font-medium">{formatNum(vague.dernierePoidsMoyen, 1, "g")}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Biomasse</p>
                        <p className="text-sm font-medium">
                          {formatNum(vague.biomasse, 2, "kg")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">SGR</p>
                        <p className="text-sm font-medium text-primary">
                          {formatNum(vague.sgr, 2, "%/j")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">FCR</p>
                        <p className="text-sm font-medium text-accent-amber">
                          {formatNum(vague.fcr, 2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Releves</p>
                        <p className="text-sm font-medium">{vague.nombreReleves}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mortalites</p>
                        <p
                          className={`text-sm font-bold ${
                            vague.totalMortalites > 0 ? "text-danger" : "text-muted-foreground"
                          }`}
                        >
                          {vague.totalMortalites}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bacs</p>
                        <p className="text-sm font-medium">{vague.nombreBacs}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Graphiques — composant client (Recharts) */}
        {vaguesDetailSerialized.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Graphiques de suivi
            </h2>
            <IngenieurClientCharts vagues={vaguesDetailSerialized} />
          </section>
        )}

        {/* Notes recentes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Notes recentes
            </h2>
            <NouvelleNoteDialog
              siteId={session.activeSiteId}
              clientSiteId={clientSiteId}
              vagues={vaguesPourNotes}
            />
          </div>

          {notesSerialized.length > 0 ? (
            <div className="flex flex-col gap-2">
              {notesSerialized.slice(0, 2).map((note: (typeof notesSerialized)[number]) => (
                <NoteDetailDialog key={note.id} note={note}>
                  <Card className={`cursor-pointer transition-colors hover:bg-accent/50 ${!note.isRead ? "border-primary/40 bg-primary/5" : ""}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!note.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="Non lue" />
                          )}
                          <p className="text-sm font-medium">{note.titre}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {note.isUrgent && (
                            <Badge variant="annulee">Urgent</Badge>
                          )}
                          {note.isFromClient && (
                            <Badge variant="info">Client</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-3 prose-compact">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <strong>{children} </strong>,
                            h2: ({ children }) => <strong>{children} </strong>,
                            h3: ({ children }) => <strong>{children} </strong>,
                            p: ({ children }) => <span>{children} </span>,
                            ul: ({ children }) => <span>{children}</span>,
                            ol: ({ children }) => <span>{children}</span>,
                            li: ({ children }) => <span>• {children} </span>,
                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                            em: ({ children }) => <em>{children}</em>,
                            code: ({ children }) => <code className="text-[10px]">{children}</code>,
                            blockquote: ({ children }) => <span>{children}</span>,
                            hr: () => null,
                          }}
                        >
                          {note.contenu}
                        </ReactMarkdown>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(note.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </CardContent>
                  </Card>
                </NoteDetailDialog>
              ))}
              {notesSerialized.length > 0 && (
                <Link
                  href={`/ingenieur/${clientSiteId}/notes`}
                  className="text-sm font-medium text-primary hover:underline text-center py-2"
                >
                  Voir plus ({notesSerialized.length})
                </Link>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center p-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Aucune note pour ce client.</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Retour */}
        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/ingenieur">
              <ArrowLeft className="h-4 w-4" />
              Retour au monitoring
            </Link>
          </Button>
        </div>

      </div>
    </>
  );
}
