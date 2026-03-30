"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/ui/form-section";
import { VisibiliteNote } from "@/types";
import type { CreateNoteIngenieurDTO } from "@/types";
import { useNoteService } from "@/services";

interface Vague {
  id: string;
  code: string;
}

interface NoteFormProps {
  /** Site DKFarm de l'ingenieur (siteId — R8) */
  siteId: string;
  /** Site client destinataire */
  clientSiteId: string;
  /** Vagues disponibles pour le site client (optionnel) */
  vagues?: Vague[];
  /** Callback appelé apres creation reussie */
  onSuccess?: () => void;
}

/**
 * Formulaire d'envoi de note ingenieur.
 *
 * Champs :
 * - titre (obligatoire)
 * - contenu Markdown (obligatoire)
 * - visibilite : PUBLIC / INTERNE (obligatoire)
 * - vagueId (optionnel)
 * - isUrgent (checkbox)
 *
 * Appelle POST /api/ingenieur/notes.
 */
export function NoteForm({ siteId: _siteId, clientSiteId, vagues = [], onSuccess }: NoteFormProps) {
  const t = useTranslations("notes");
  const queryClient = useQueryClient();
  const noteService = useNoteService();

  // Champs du formulaire
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [visibility, setVisibility] = useState<VisibiliteNote>(VisibiliteNote.PUBLIC);
  const [vagueId, setVagueId] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setTitre("");
    setContenu("");
    setVisibility(VisibiliteNote.PUBLIC);
    setVagueId("");
    setIsUrgent(false);
    setErrors({});
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!titre.trim()) newErrors.titre = t("form.erreurs.titreRequis");
    if (!contenu.trim()) newErrors.contenu = t("form.erreurs.contenuRequis");
    if (!visibility) newErrors.visibility = t("form.erreurs.visibiliteRequise");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateNoteIngenieurDTO = {
      titre: titre.trim(),
      contenu: contenu.trim(),
      visibility,
      isUrgent,
      isFromClient: false,
      clientSiteId,
      ...(vagueId ? { vagueId } : {}),
    };

    const result = await noteService.createNote(payload);
    if (result.ok) {
      resetForm();
      if (onSuccess) {
        onSuccess();
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormSection
        title={t("form.sectionInfos")}
        description={t("form.sectionInfosDescription")}
      >
        <Input
          id="titre"
          label={t("form.titreLabel")}
          placeholder={t("form.titrePlaceholder")}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          error={errors.titre}
        />

        <MarkdownEditor
          id="contenu"
          label={t("form.contenuLabel")}
          placeholder={t("form.contenuPlaceholder")}
          value={contenu}
          onChange={setContenu}
          error={errors.contenu}
          rows={6}
        />
      </FormSection>

      <FormSection
        title={t("form.sectionOptions")}
        description={t("form.sectionOptionsDescription")}
      >
        {/* Visibilite */}
        <Select
          value={visibility}
          onValueChange={(val) => setVisibility(val as VisibiliteNote)}
        >
          <SelectTrigger
            label={t("form.visibiliteLabel")}
            error={errors.visibility}
          >
            <SelectValue placeholder={t("form.visibilitePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={VisibiliteNote.PUBLIC}>
              {t("form.visibilitePublique")}
            </SelectItem>
            <SelectItem value={VisibiliteNote.INTERNE}>
              {t("form.visibiliteInterne")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Vague associee (optionnel) */}
        {vagues.length > 0 && (
          <Select
            value={vagueId}
            onValueChange={(val) => setVagueId(val === "none" ? "" : val)}
          >
            <SelectTrigger label={t("form.vagueLabel")}>
              <SelectValue placeholder={t("form.vagueAucune")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("form.vagueAucune")}</SelectItem>
              {vagues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Urgence */}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--danger)]"
          />
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
            <span className="text-sm font-medium">{t("form.urgente")}</span>
          </div>
        </label>
      </FormSection>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={resetForm}
        >
          {t("form.reinitialiser")}
        </Button>
        <Button type="submit">
          <Send className="h-4 w-4" /> {t("form.envoyer")}
        </Button>
      </div>
    </form>
  );
}
