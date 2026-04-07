"use client";

import { useId, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { wrapSelection, toggleLinePrefix } from "@/lib/markdown-toolbar";

interface MarkdownEditorProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows?: number;
  className?: string;
}

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  action: (textarea: HTMLTextAreaElement) => {
    value: string;
    selectionStart: number;
    selectionEnd: number;
  };
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    icon: Bold,
    titleKey: "bold",
    action: (ta) => wrapSelection(ta, "**", "**", "gras"),
  },
  {
    icon: Italic,
    titleKey: "italic",
    action: (ta) => wrapSelection(ta, "*", "*", "italique"),
  },
  {
    icon: Heading2,
    titleKey: "heading2",
    action: (ta) => toggleLinePrefix(ta, "## "),
  },
  {
    icon: Heading3,
    titleKey: "heading3",
    action: (ta) => toggleLinePrefix(ta, "### "),
  },
  {
    icon: List,
    titleKey: "list",
    action: (ta) => toggleLinePrefix(ta, "- "),
  },
  {
    icon: ListOrdered,
    titleKey: "orderedList",
    action: (ta) => toggleLinePrefix(ta, "1. "),
  },
  {
    icon: Quote,
    titleKey: "quote",
    action: (ta) => toggleLinePrefix(ta, "> "),
  },
];

function MarkdownEditor({
  id: idProp,
  label,
  placeholder,
  value,
  onChange,
  error,
  rows = 6,
  className,
}: MarkdownEditorProps) {
  const t = useTranslations("common.markdownEditor");
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAction = useCallback(
    (action: ToolbarAction["action"]) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const result = action(ta);
      onChange(result.value);

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-lg border",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          error ? "border-danger" : "border-border"
        )}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 border-b border-border p-1">
          {TOOLBAR_ACTIONS.map((item) => (
            <button
              key={item.titleKey}
              type="button"
              title={t(item.titleKey as Parameters<typeof t>[0])}
              aria-label={t(item.titleKey as Parameters<typeof t>[0])}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md",
                "text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                "active:bg-muted/80"
              )}
              onMouseDown={(e) => {
                // Prevent textarea blur / keyboard dismiss on mobile
                e.preventDefault();
                handleAction(item.action);
              }}
            >
              <item.icon className="h-5 w-5" />
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={cn(
            "flex w-full bg-transparent px-3 py-2 text-base",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[88px] resize-y border-none",
            className
          )}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

MarkdownEditor.displayName = "MarkdownEditor";

export { MarkdownEditor, type MarkdownEditorProps };
