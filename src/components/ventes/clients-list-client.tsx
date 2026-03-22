"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
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
import { Permission } from "@/types";
import { useVenteService } from "@/services";

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
  const t = useTranslations("ventes");
  const queryClient = useQueryClient();
  const venteService = useVenteService();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

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

    const dto = {
      nom: nom.trim(),
      ...(telephone.trim() && { telephone: telephone.trim() }),
      ...(email.trim() && { email: email.trim() }),
      ...(adresse.trim() && { adresse: adresse.trim() }),
    };

    const result = editId
      ? await venteService.updateClient(editId, dto)
      : await venteService.createClient(dto);

    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("clients.count", { count: clients.length })}
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
                {t("clients.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editId ? t("clients.edit") : t("clients.add")}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label={t("clients.fields.nom")}
                  placeholder={t("clients.fields.nomPlaceholder")}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoFocus
                />
                <Input
                  label={t("clients.fields.telephone")}
                  type="tel"
                  placeholder={t("clients.fields.telephonePlaceholder")}
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
                <Input
                  label={t("clients.fields.email")}
                  type="email"
                  placeholder={t("clients.fields.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label={t("clients.fields.adresse")}
                  placeholder={t("clients.fields.adressePlaceholder")}
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("paiements.cancel")}</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={!nom.trim()}>
                  {editId ? t("clients.save") : t("clients.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">{t("clients.empty")}</p>
          <p className="text-sm text-muted-foreground">
            {t("clients.emptyDescription")}
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
                    <span>{t("clients.stats.ventes", { count: c._count.ventes })}</span>
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
