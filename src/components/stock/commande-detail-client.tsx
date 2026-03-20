"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Truck,
  Send,
  PackageCheck,
  X,
  FileText,
  ImageIcon,
  Upload,
  Eye,
  Trash2,
} from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { StatutCommande, UniteStock, Permission } from "@/types";

const statutLabels: Record<StatutCommande, string> = {
  [StatutCommande.BROUILLON]: "Brouillon",
  [StatutCommande.ENVOYEE]: "Envoyee",
  [StatutCommande.LIVREE]: "Livree",
  [StatutCommande.ANNULEE]: "Annulee",
};

const statutVariants: Record<StatutCommande, "default" | "info" | "en_cours" | "warning"> = {
  [StatutCommande.BROUILLON]: "default",
  [StatutCommande.ENVOYEE]: "info",
  [StatutCommande.LIVREE]: "en_cours",
  [StatutCommande.ANNULEE]: "warning",
};

const uniteLabels: Record<string, string> = {
  [UniteStock.GRAMME]: "g",
  [UniteStock.KG]: "kg",
  [UniteStock.MILLILITRE]: "mL",
  [UniteStock.LITRE]: "L",
  [UniteStock.UNITE]: "unite",
  [UniteStock.SACS]: "sacs",
};

interface LigneData {
  id: string;
  quantite: number;
  prixUnitaire: number;
  produit: { id: string; nom: string; unite: string; uniteAchat: string | null; contenance: number | null };
}

interface CommandeData {
  id: string;
  numero: string;
  statut: string;
  dateCommande: string;
  dateLivraison: string | null;
  montantTotal: number;
  factureUrl: string | null;
  fournisseur: {
    id: string;
    nom: string;
    telephone: string | null;
    email: string | null;
  };
  user: { id: string; name: string };
  lignes: LigneData[];
}

interface Props {
  commande: CommandeData;
  permissions: Permission[];
}

/** Icône selon le type de fichier (PDF vs image) */
function FileIcon({ mimeOrName }: { mimeOrName: string }) {
  const isPdf =
    mimeOrName.includes("pdf") || mimeOrName.toLowerCase().endsWith(".pdf");
  if (isPdf) return <FileText className="h-5 w-5 text-destructive" />;
  return <ImageIcon className="h-5 w-5 text-primary" />;
}

/** Détermine le type depuis le nom de fichier */
function guessTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "";
}

export function CommandeDetailClient({ commande: initialCommande, permissions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recuFileInputRef = useRef<HTMLInputElement>(null);

  const [commande, setCommande] = useState(initialCommande);
  const [recevoirOpen, setRecevoirOpen] = useState(false);
  const [deleteFactureOpen, setDeleteFactureOpen] = useState(false);
  const [uploadFactureOpen, setUploadFactureOpen] = useState(false);
  const [dateLivraison, setDateLivraison] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recuFile, setRecuFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const statut = commande.statut as StatutCommande;
  const canManage = permissions.includes(Permission.APPROVISIONNEMENT_GERER);

  // ─── Actions commande (envoyer, annuler) ───────────────────────
  async function handleAction(action: string) {
    setLoading(action);
    try {
      const url = `/api/commandes/${commande.id}/${action}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const messages: Record<string, string> = {
          envoyer: "Commande envoyee",
          annuler: "Commande annulee",
        };
        toast({ title: messages[action] || "Action effectuee", variant: "success" });
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(null);
    }
  }

  // ─── Réceptionner commande (avec fichier optionnel) ─────────────
  async function handleRecevoir() {
    setLoading("recevoir");
    try {
      let res: Response;

      if (recuFile) {
        // Envoyer en FormData avec fichier
        const formData = new FormData();
        formData.set("dateLivraison", dateLivraison);
        formData.set("file", recuFile);
        res = await fetch(`/api/commandes/${commande.id}/recevoir`, {
          method: "POST",
          body: formData,
        });
      } else {
        // Envoyer en JSON (comportement inchangé)
        res = await fetch(`/api/commandes/${commande.id}/recevoir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dateLivraison }),
        });
      }

      if (res.ok) {
        toast({ title: "Commande receptionnee", variant: "success" });
        setRecevoirOpen(false);
        setRecuFile(null);
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(null);
    }
  }

  // ─── Upload facture séparé (commande déjà LIVREE) ───────────────
  async function handleUploadFacture() {
    if (!selectedFile) return;
    setLoading("upload");
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const res = await fetch(`/api/commandes/${commande.id}/facture`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast({ title: "Facture uploadee avec succes", variant: "success" });
        setUploadFactureOpen(false);
        setSelectedFile(null);
        // Mettre à jour localement le factureUrl pour éviter un refresh complet
        setCommande((prev) => ({
          ...prev,
          factureUrl: `factures/${commande.id}/uploaded`,
        }));
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur upload", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(null);
    }
  }

  // ─── Voir la facture (ouvre signed URL dans nouvel onglet) ───────
  async function handleVoirFacture() {
    setLoading("voir");
    try {
      const res = await fetch(`/api/commandes/${commande.id}/facture`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(null);
    }
  }

  // ─── Supprimer la facture ───────────────────────────────────────
  async function handleDeleteFacture() {
    setLoading("delete");
    try {
      const res = await fetch(`/api/commandes/${commande.id}/facture`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Facture supprimee", variant: "success" });
        setDeleteFactureOpen(false);
        setCommande((prev) => ({ ...prev, factureUrl: null }));
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(null);
    }
  }

  // ─── Validation fichier côté client (UX rapide avant envoi) ────
  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setter(null);
      return;
    }

    const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
    const MAX = 10 * 1024 * 1024;

    if (!ALLOWED.includes(file.type)) {
      toast({
        title: "Format non autorise. Utiliser PDF, JPG ou PNG.",
        variant: "error",
      });
      e.target.value = "";
      setter(null);
      return;
    }

    if (file.size > MAX) {
      toast({
        title: `Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Max 10 Mo.`,
        variant: "error",
      });
      e.target.value = "";
      setter(null);
      return;
    }

    setter(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock/commandes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Commandes
      </Link>

      {/* Header info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{commande.numero}</h2>
            <Badge variant={statutVariants[statut]}>
              {statutLabels[statut]}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4 shrink-0" />
              <span>{commande.fournisseur.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                Commande : {new Date(commande.dateCommande).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {commande.dateLivraison && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <PackageCheck className="h-4 w-4 shrink-0" />
                <span>
                  Livraison : {new Date(commande.dateLivraison).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">
              {commande.montantTotal.toLocaleString("fr-FR")} FCFA
            </p>
            <p className="text-xs text-muted-foreground">Montant total</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions commande */}
      {canManage && (statut === StatutCommande.BROUILLON || statut === StatutCommande.ENVOYEE) && (
        <div className="flex gap-2">
          {statut === StatutCommande.BROUILLON && (
            <Button
              className="flex-1"
              onClick={() => handleAction("envoyer")}
              disabled={loading !== null}
            >
              <Send className="h-4 w-4 mr-1" />
              {loading === "envoyer" ? "Envoi..." : "Envoyer"}
            </Button>
          )}
          {statut === StatutCommande.ENVOYEE && (
            <>
              <Button
                className="flex-1"
                onClick={() => setRecevoirOpen(true)}
                disabled={loading !== null}
              >
                <PackageCheck className="h-4 w-4 mr-1" />
                Receptionner
              </Button>

              {/* Dialog réception avec upload optionnel */}
              <Dialog open={recevoirOpen} onOpenChange={setRecevoirOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Receptionner la commande</DialogTitle>
                    <DialogDescription>
                      Cette action va creer des mouvements d&apos;entree et mettre a jour le stock.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-3">
                    <Input
                      label="Date de livraison"
                      type="date"
                      value={dateLivraison}
                      onChange={(e) => setDateLivraison(e.target.value)}
                    />

                    {/* Champ file optionnel */}
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Facture fournisseur (optionnel)
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        PDF, JPG ou PNG — max 10 Mo
                      </p>
                      <input
                        ref={recuFileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setRecuFile)}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        type="button"
                        onClick={() => recuFileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {recuFile ? "Changer le fichier" : "Choisir un fichier"}
                      </Button>
                      {recuFile && (
                        <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50">
                          <FileIcon mimeOrName={recuFile.name} />
                          <span className="text-sm truncate flex-1">{recuFile.name}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setRecuFile(null);
                              if (recuFileInputRef.current) recuFileInputRef.current.value = "";
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" onClick={() => setRecuFile(null)}>
                        Annuler
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleRecevoir}
                      disabled={loading === "recevoir"}
                    >
                      {loading === "recevoir" ? "Reception..." : "Confirmer la reception"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            variant="danger"
            onClick={() => handleAction("annuler")}
            disabled={loading !== null}
          >
            <X className="h-4 w-4 mr-1" />
            {loading === "annuler" ? "..." : "Annuler"}
          </Button>
        </div>
      )}

      {/* Section Facture fournisseur */}
      {canManage && statut === StatutCommande.LIVREE && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facture fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {commande.factureUrl ? (
              /* Facture existante : afficher avec boutons Voir + Supprimer */
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <FileIcon mimeOrName={commande.factureUrl} />
                  <p className="text-sm text-muted-foreground flex-1 truncate">
                    Facture attachee
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleVoirFacture}
                    disabled={loading !== null}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {loading === "voir" ? <><FishLoader size="sm" /> Chargement...</> : "Voir la facture"}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeleteFactureOpen(true)}
                    disabled={loading !== null}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Pas de facture : afficher bouton Ajouter */
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Aucune facture attachee a cette commande.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setUploadFactureOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Ajouter la facture
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog upload facture séparé */}
      <Dialog open={uploadFactureOpen} onOpenChange={setUploadFactureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une facture</DialogTitle>
            <DialogDescription>
              Uploadez la facture fournisseur pour cette commande (PDF, JPG ou PNG — max 10 Mo).
            </DialogDescription>
          </DialogHeader>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFileChange(e, setSelectedFile)}
            />
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {selectedFile ? "Changer le fichier" : "Choisir un fichier"}
            </Button>
            {selectedFile && (
              <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-muted/50">
                <FileIcon mimeOrName={guessTypeFromName(selectedFile.name)} />
                <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} Mo
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Annuler
              </Button>
            </DialogClose>
            <Button
              onClick={handleUploadFacture}
              disabled={!selectedFile || loading === "upload"}
            >
              {loading === "upload" ? "Upload..." : "Uploader la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression facture */}
      <Dialog open={deleteFactureOpen} onOpenChange={setDeleteFactureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la facture</DialogTitle>
            <DialogDescription>
              Cette action est irreversible. Le fichier sera definitivement supprime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={handleDeleteFacture}
              disabled={loading === "delete"}
            >
              {loading === "delete" ? <><FishLoader size="sm" /> Suppression...</> : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lignes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Lignes ({commande.lignes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {commande.lignes.map((ligne) => {
              const hasAchat = ligne.produit.uniteAchat;
              const displayUnite = hasAchat
                ? (uniteLabels[ligne.produit.uniteAchat!] ?? ligne.produit.uniteAchat!)
                : (uniteLabels[ligne.produit.unite] ?? ligne.produit.unite);
              const sousTotal = ligne.quantite * ligne.prixUnitaire;
              return (
                <div key={ligne.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ligne.produit.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ligne.quantite} {displayUnite} x {ligne.prixUnitaire.toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">
                    {sousTotal.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Cree par {commande.user.name}
      </p>
    </div>
  );
}
