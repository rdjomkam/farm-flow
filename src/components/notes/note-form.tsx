"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
    if (!titre.trim()) newErrors.titre = "Le titre est obligatoire.";
    if (!contenu.trim()) newErrors.contenu = "Le contenu est obligatoire.";
    if (!visibility) newErrors.visibility = "La visibilite est obligatoire.";
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
        router.refresh();
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormSection
        title="Informations de la note"
        description="Redigez la note destinee au client"
      >
        <Input
          id="titre"
          label="Titre"
          placeholder="Ex : Resultats biometrie semaine 12"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          error={errors.titre}
        />

        <MarkdownEditor
          id="contenu"
          label="Contenu"
          placeholder="Redigez le contenu de la note..."
          value={contenu}
          onChange={setContenu}
          error={errors.contenu}
          rows={6}
        />
      </FormSection>

      <FormSection
        title="Options"
        description="Visibilite et parametres supplementaires"
      >
        {/* Visibilite */}
        <Select
          value={visibility}
          onValueChange={(val) => setVisibility(val as VisibiliteNote)}
        >
          <SelectTrigger
            label="Visibilite"
            error={errors.visibility}
          >
            <SelectValue placeholder="Selectionnez la visibilite" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={VisibiliteNote.PUBLIC}>
              Public — visible par le client
            </SelectItem>
            <SelectItem value={VisibiliteNote.INTERNE}>
              Interne — usage DKFarm uniquement
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Vague associee (optionnel) */}
        {vagues.length > 0 && (
          <Select
            value={vagueId}
            onValueChange={(val) => setVagueId(val === "none" ? "" : val)}
          >
            <SelectTrigger label="Vague concernee (optionnel)">
              <SelectValue placeholder="Aucune vague" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune vague</SelectItem>
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
            <span className="text-sm font-medium">Marquer comme urgente</span>
          </div>
        </label>
      </FormSection>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={resetForm}
        >
          Reinitialiser
        </Button>
        <Button type="submit">
          <Send className="h-4 w-4" /> Envoyer la note
        </Button>
      </div>
    </form>
  );
}
