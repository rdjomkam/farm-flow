"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Phone, Mail, MapPin, Pencil, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Permission } from "@/types";

interface ClientData {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  _count: { ventes: number };
}

interface Props {
  clients: ClientData[];
  permissions: Permission[];
}

export function ClientsListClient({ clients, permissions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");

  function resetForm() {
    setNom("");
    setTelephone("");
    setEmail("");
    setAdresse("");
    setEditId(null);
  }

  function openEdit(c: ClientData) {
    setNom(c.nom);
    setTelephone(c.telephone ?? "");
    setEmail(c.email ?? "");
    setAdresse(c.adresse ?? "");
    setEditId(c.id);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!nom.trim()) return;
    setCreating(true);

    try {
      const url = editId ? `/api/clients/${editId}` : "/api/clients";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          ...(telephone.trim() && { telephone: telephone.trim() }),
          ...(email.trim() && { email: email.trim() }),
          ...(adresse.trim() && { adresse: adresse.trim() }),
        }),
      });

      if (res.ok) {
        toast({
          title: editId ? "Client mis a jour" : "Client cree",
          variant: "success",
        });
        setDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clients.length} client{clients.length > 1 ? "s" : ""}
        </p>
        {permissions.includes(Permission.CLIENTS_GERER) && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editId ? "Modifier le client" : "Ajouter un client"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label="Nom"
                  placeholder="Ex: Restaurant Le Mboa"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Telephone (optionnel)"
                  type="tel"
                  placeholder="6XX XX XX XX (+237 ajouté automatiquement)"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
                <Input
                  label="Email (optionnel)"
                  type="email"
                  placeholder="contact@client.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="Adresse (optionnel)"
                  placeholder="Douala, Cameroun"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={creating || !nom.trim()}>
                  {creating
                    ? editId ? "Enregistrement..." : "Creation..."
                    : editId ? "Enregistrer" : "Creer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Aucun client</p>
          <p className="text-sm text-muted-foreground">
            Ajoutez vos clients pour enregistrer des ventes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-accent-blue shrink-0" />
                      <h3 className="font-semibold truncate">{c.nom}</h3>
                    </div>
                    <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                      {c.telephone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.telephone}
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.adresse && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{c.adresse}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    <span>{c._count.ventes} vente{c._count.ventes > 1 ? "s" : ""}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
