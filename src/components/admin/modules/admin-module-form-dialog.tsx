"use client";

/**
 * admin-module-form-dialog.tsx
 *
 * Formulaire d'edition des metadonnees d'un ModuleDefinition.
 * Mode edition uniquement — key et level sont NON-MODIFIABLES (R5 : asChild).
 *
 * Champs editables : label, description, iconName, sortOrder, category, isVisible, isActive.
 * Calls PUT /api/admin/modules/[key].
 *
 * Story E.2 — Sprint E (ADR-021).
 * R5 : DialogTrigger asChild.
 * R6 : couleurs via CSS variables.
 */

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ModuleDefinitionResponse } from "@/types";

// ---------------------------------------------------------------------------
// Toggle switch simple
// ---------------------------------------------------------------------------

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  id: string;
}

function Toggle({ label, description, checked, onChange, id }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          checked ? "bg-primary" : "bg-muted",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form dialog
// ---------------------------------------------------------------------------

interface AdminModuleFormDialogProps {
  module: ModuleDefinitionResponse;
  onUpdated: (updated: ModuleDefinitionResponse) => void;
}

export function AdminModuleFormDialog({ module, onUpdated }: AdminModuleFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — only editable fields
  const [label, setLabel] = useState(module.label);
  const [description, setDescription] = useState(module.description ?? "");
  const [iconName, setIconName] = useState(module.iconName);
  const [sortOrder, setSortOrder] = useState(String(module.sortOrder));
  const [category, setCategory] = useState(module.category ?? "");
  const [isVisible, setIsVisible] = useState(module.isVisible);
  const [isActive, setIsActive] = useState(module.isActive);

  function resetForm() {
    setLabel(module.label);
    setDescription(module.description ?? "");
    setIconName(module.iconName);
    setSortOrder(String(module.sortOrder));
    setCategory(module.category ?? "");
    setIsVisible(module.isVisible);
    setIsActive(module.isActive);
    setError(null);
  }

  function handleOpenChange(val: boolean) {
    if (!val) resetForm();
    setOpen(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sortOrderNum = parseInt(sortOrder, 10);
    if (isNaN(sortOrderNum)) {
      setError("L'ordre de tri doit etre un nombre entier.");
      return;
    }

    if (!label.trim()) {
      setError("Le libelle est obligatoire.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/modules/${encodeURIComponent(module.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || null,
          iconName: iconName.trim() || "Package",
          sortOrder: sortOrderNum,
          category: category.trim() || null,
          isVisible,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; message?: string };
        setError(data.error ?? data.message ?? "Une erreur est survenue.");
        return;
      }

      const updated = (await res.json()) as ModuleDefinitionResponse;
      onUpdated(updated);
      setOpen(false);
    } catch {
      setError("Erreur reseau. Veuillez reessayer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* R5 : DialogTrigger asChild */}
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Modifier</span>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le module</DialogTitle>
          <DialogDescription>
            Mise a jour des metadonnees du module. La cle et le niveau sont immuables.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Immutable fields — displayed read-only */}
          <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cle (immuable)
              </span>
              <span className="font-mono text-sm text-foreground">{module.key}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Niveau (immuable)
              </span>
              <span className="text-sm text-foreground capitalize">{module.level}</span>
            </div>
          </div>

          {/* Label */}
          <Input
            label="Libelle *"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Grossissement"
            required
            disabled={saving}
          />

          {/* Description */}
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optionnelle du module..."
            disabled={saving}
          />

          {/* Icon name */}
          <Input
            label="Nom de l'icone (Lucide)"
            value={iconName}
            onChange={(e) => setIconName(e.target.value)}
            placeholder="Ex : Package, Fish, BarChart3..."
            disabled={saving}
          />

          {/* Sort order + category — inline on desktop */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Ordre de tri"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              min={0}
              step={1}
              disabled={saving}
            />
            <Input
              label="Categorie"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex : production, finance..."
              disabled={saving}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 rounded-lg border border-border px-4 py-3">
            <Toggle
              id="toggle-visible"
              label="Visible"
              description="Le module est affiche dans les interfaces de selection"
              checked={isVisible}
              onChange={setIsVisible}
            />
            <div className="border-t border-border" />
            <Toggle
              id="toggle-active"
              label="Actif"
              description="Le module peut etre active sur les sites"
              checked={isActive}
              onChange={setIsActive}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
