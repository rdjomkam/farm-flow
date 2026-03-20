"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Variable, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConfigService } from "@/services";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomPlaceholderData {
  id: string;
  key: string;
  label: string;
  description: string | null;
  example: string;
  mode: "MAPPING" | "FORMULA";
  sourcePath: string | null;
  formula: string | null;
  format: "NUMBER" | "TEXT";
  decimals: number;
  isActive: boolean;
}

interface Props {
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Source path entities (must match server-side SOURCE_PATH_ENTITIES)
// ---------------------------------------------------------------------------

import { SOURCE_PATH_ENTITIES } from "@/lib/source-path-entities";

/** Find entity key from a full source path (for edit mode pre-selection) */
function findEntityKeyForPath(path: string): string {
  for (const entity of SOURCE_PATH_ENTITIES) {
    if (entity.fields.some((f) => f.path === path)) {
      return entity.key;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaceholdersClient({ canManage }: Props) {
  const [placeholders, setPlaceholders] = useState<CustomPlaceholderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomPlaceholderData | null>(null);
  const configService = useConfigService();

  const fetchPlaceholders = useCallback(async () => {
    const result = await configService.listPlaceholders();
    if (result.ok && result.data) {
      const data = result.data as { placeholders?: CustomPlaceholderData[] };
      setPlaceholders(data.placeholders ?? []);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPlaceholders();
  }, [fetchPlaceholders]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(ph: CustomPlaceholderData) {
    setEditing(ph);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce placeholder personnalise ?")) return;
    const result = await configService.deletePlaceholder(id);
    if (result.ok) {
      fetchPlaceholders();
    }
  }

  async function handleSave(data: Omit<CustomPlaceholderData, "id" | "isActive">) {
    let result;
    if (editing) {
      result = await configService.updatePlaceholder(
        editing.id,
        data as Parameters<typeof configService.updatePlaceholder>[1]
      );
    } else {
      result = await configService.createPlaceholder(data as Parameters<typeof configService.createPlaceholder>[0]);
    }
    if (result.ok) {
      setDialogOpen(false);
      fetchPlaceholders();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <Link
        href="/settings/regles-activites"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux regles
      </Link>

      {/* Header with add button */}
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Nouveau placeholder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Modifier le placeholder" : "Nouveau placeholder"}
                </DialogTitle>
              </DialogHeader>
              <PlaceholderForm
                initial={editing}
                onSave={handleSave}
                onCancel={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* List */}
      {placeholders.length === 0 ? (
        <div className="text-center py-12">
          <Variable className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun placeholder personnalise.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {placeholders.map((ph) => (
            <div
              key={ph.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {`{${ph.key}}`}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {ph.mode === "MAPPING" ? "Mapping" : "Formule"}
                  </span>
                  {!ph.isActive && (
                    <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                      Inactif
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground mt-1">{ph.label}</p>
                {ph.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ph.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Exemple : {ph.example}
                  {ph.mode === "MAPPING" && ph.sourcePath && (
                    <> — Chemin : <code>{ph.sourcePath}</code></>
                  )}
                  {ph.mode === "FORMULA" && ph.formula && (
                    <> — Formule : <code>{ph.formula}</code></>
                  )}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(ph)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 text-danger"
                    onClick={() => handleDelete(ph.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder Form
// ---------------------------------------------------------------------------

interface FormProps {
  initial: CustomPlaceholderData | null;
  onSave: (data: Omit<CustomPlaceholderData, "id" | "isActive">) => void;
  onCancel: () => void;
}

function PlaceholderForm({ initial, onSave, onCancel }: FormProps) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [example, setExample] = useState(initial?.example ?? "");
  const [mode, setMode] = useState<"MAPPING" | "FORMULA">(
    initial?.mode ?? "MAPPING"
  );
  const [entityKey, setEntityKey] = useState(
    initial?.sourcePath ? findEntityKeyForPath(initial.sourcePath) : ""
  );
  const [sourcePath, setSourcePath] = useState(initial?.sourcePath ?? "");
  const [formula, setFormula] = useState(initial?.formula ?? "");
  const [format, setFormat] = useState<"NUMBER" | "TEXT">(
    initial?.format ?? "NUMBER"
  );
  const [decimals, setDecimals] = useState(initial?.decimals ?? 2);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      key,
      label,
      description: description || null,
      example,
      mode,
      sourcePath: mode === "MAPPING" ? sourcePath : null,
      formula: mode === "FORMULA" ? formula : null,
      format,
      decimals,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Key */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Cle <span className="text-danger">*</span>
        </label>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="ex: mortalite_pct"
          pattern="^[a-z][a-z0-9_]*$"
          title="Minuscules, chiffres et underscores uniquement"
          required
          disabled={!!initial} // cannot change key after creation
        />
        <p className="text-xs text-muted-foreground mt-1">
          Utilisable dans les templates comme {`{${key || "cle"}}`}
        </p>
      </div>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Libelle <span className="text-danger">*</span>
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex: Taux mortalite cumulee (%)"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Aide affichee dans l'editeur de template"
          rows={2}
        />
      </div>

      {/* Example */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Valeur d&apos;exemple <span className="text-danger">*</span>
        </label>
        <Input
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="ex: 12,5"
          required
        />
      </div>

      {/* Mode */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Mode de resolution <span className="text-danger">*</span>
        </label>
        <Select value={mode} onValueChange={(v) => setMode(v as "MAPPING" | "FORMULA")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MAPPING">Mapping (chemin dans le contexte)</SelectItem>
            <SelectItem value="FORMULA">Formule arithmetique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Source path (MAPPING) — two-level selector: entity then field */}
      {mode === "MAPPING" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Entite <span className="text-danger">*</span>
            </label>
            <Select
              value={entityKey}
              onValueChange={(v) => {
                setEntityKey(v);
                setSourcePath("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selectionnez une entite..." />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_PATH_ENTITIES.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entityKey && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Champ <span className="text-danger">*</span>
              </label>
              <Select value={sourcePath} onValueChange={setSourcePath}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionnez un champ..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_PATH_ENTITIES.find((e) => e.key === entityKey)?.fields.map((f) => (
                    <SelectItem key={f.path} value={f.path}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Formula (FORMULA) */}
      {mode === "FORMULA" && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Formule <span className="text-danger">*</span>
          </label>
          <Input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="ex: poids_moyen * 1.2"
            required
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Operateurs : + - * / ( ). Identifiants : cles de placeholders ou chemins (ex: indicateurs.biomasse)
          </p>
        </div>
      )}

      {/* Format */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-1">
            Format
          </label>
          <Select value={format} onValueChange={(v) => setFormat(v as "NUMBER" | "TEXT")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NUMBER">Nombre</SelectItem>
              <SelectItem value="TEXT">Texte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {format === "NUMBER" && (
          <div className="w-24">
            <label className="block text-sm font-medium text-foreground mb-1">
              Decimales
            </label>
            <Input
              type="number"
              min={0}
              max={6}
              value={decimals}
              onChange={(e) => setDecimals(parseInt(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">
          {initial ? "Enregistrer" : "Creer"}
        </Button>
      </div>
    </form>
  );
}
