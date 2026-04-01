"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Truck, ArrowLeft, Phone, Mail, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Permission } from "@/types";
import type { FournisseurListResponse } from "@/types";
import { useFournisseursList, useCreateFournisseur, useUpdateFournisseur } from "@/hooks/queries/use-stock-queries";

interface FournisseurData {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  _count: { produits: number; commandes: number };
}

interface Props {
  fournisseurs: FournisseurData[];
  permissions: Permission[];
}

export function FournisseursListClient({ fournisseurs: initialFournisseurs, permissions }: Props) {
  const t = useTranslations("stock");
  const { data: fournisseursRaw = initialFournisseurs } = useFournisseursList({
    initialData: initialFournisseurs as unknown as FournisseurListResponse["fournisseurs"],
  });
  const fournisseurs = fournisseursRaw as unknown as FournisseurData[];
  const createFournisseurMutation = useCreateFournisseur();
  const updateFournisseurMutation = useUpdateFournisseur();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
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

  function openEdit(f: FournisseurData) {
    setNom(f.nom);
    setTelephone(f.telephone ?? "");
    setEmail(f.email ?? "");
    setAdresse(f.adresse ?? "");
    setEditId(f.id);
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

    try {
      if (editId) {
        await updateFournisseurMutation.mutateAsync({ id: editId, dto });
      } else {
        await createFournisseurMutation.mutateAsync(dto);
      }
      setDialogOpen(false);
      resetForm();
    } catch {
      // Error already handled by useApi toast
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("actions.back")}
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("fournisseurs.count", { count: fournisseurs.length })}
        </p>
        {permissions.includes(Permission.APPROVISIONNEMENT_GERER) && (
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
                {t("fournisseurs.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editId ? t("fournisseurs.edit") : t("fournisseurs.add")}
                </DialogTitle>
              </DialogHeader>
              <DialogBody>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label={t("fournisseurs.fields.nom")}
                  placeholder={t("fournisseurs.fields.nomPlaceholder")}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoFocus
                />
                <Input
                  label={t("fournisseurs.fields.telephone")}
                  type="tel"
                  placeholder={t("fournisseurs.fields.telephonePlaceholder")}
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
                <Input
                  label={t("fournisseurs.fields.email")}
                  type="email"
                  placeholder={t("fournisseurs.fields.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label={t("fournisseurs.fields.adresse")}
                  placeholder={t("fournisseurs.fields.adressePlaceholder")}
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                />
              </div>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("actions.cancel")}</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={!nom.trim()}>
                  {editId ? t("fournisseurs.save") : t("fournisseurs.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {fournisseurs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Truck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">{t("fournisseurs.empty")}</p>
          <p className="text-sm text-muted-foreground">
            {t("fournisseurs.emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fournisseurs.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-accent-purple shrink-0" />
                      <h3 className="font-semibold truncate">{f.nom}</h3>
                    </div>
                    <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                      {f.telephone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {f.telephone}
                        </div>
                      )}
                      {f.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{f.email}</span>
                        </div>
                      )}
                      {f.adresse && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{f.adresse}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(f)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  <span>{t("fournisseurs.stats.produits", { count: f._count.produits })}</span>
                  <span>{t("fournisseurs.stats.commandes", { count: f._count.commandes })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
