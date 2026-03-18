/**
 * Pure utility functions for markdown toolbar actions on a textarea.
 */

interface TextareaResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wraps the current selection with before/after markers (e.g. **bold**).
 * If nothing is selected, inserts a placeholder between the markers.
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "texte"
): TextareaResult {
  const { value, selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);

  if (selected.length === 0) {
    // No selection — insert placeholder
    const inserted = `${before}${placeholder}${after}`;
    return {
      value: value.slice(0, selectionStart) + inserted + value.slice(selectionEnd),
      selectionStart: selectionStart + before.length,
      selectionEnd: selectionStart + before.length + placeholder.length,
    };
  }

  // Check if already wrapped — toggle off
  const beforeMatch =
    value.slice(selectionStart - before.length, selectionStart) === before;
  const afterMatch =
    value.slice(selectionEnd, selectionEnd + after.length) === after;

  if (beforeMatch && afterMatch) {
    // Remove wrapping
    return {
      value:
        value.slice(0, selectionStart - before.length) +
        selected +
        value.slice(selectionEnd + after.length),
      selectionStart: selectionStart - before.length,
      selectionEnd: selectionEnd - before.length,
    };
  }

  // Wrap selection
  const wrapped = `${before}${selected}${after}`;
  return {
    value: value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd),
    selectionStart: selectionStart + before.length,
    selectionEnd: selectionEnd + before.length,
  };
}

/**
 * Toggles a line prefix (e.g. "## ", "- ", "> ") on the current line or
 * each line in a multi-line selection.
 */
export function toggleLinePrefix(
  textarea: HTMLTextAreaElement,
  prefix: string
): TextareaResult {
  const { value, selectionStart, selectionEnd } = textarea;

  // Find the start of the first selected line
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  // Find the end of the last selected line
  const lineEnd =
    value.indexOf("\n", selectionEnd) === -1
      ? value.length
      : value.indexOf("\n", selectionEnd);

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  // Check if ALL lines already have the prefix
  const allPrefixed = lines.every((line) => line.startsWith(prefix));

  let newBlock: string;
  let deltaFirst: number;
  let totalDelta: number;

  if (allPrefixed) {
    // Remove prefix from each line
    const newLines = lines.map((line) => line.slice(prefix.length));
    newBlock = newLines.join("\n");
    deltaFirst = -prefix.length;
    totalDelta = -prefix.length * lines.length;
  } else {
    // Add prefix to each line (skip lines that already have it)
    const newLines = lines.map((line) =>
      line.startsWith(prefix) ? line : prefix + line
    );
    newBlock = newLines.join("\n");
    deltaFirst = lines[0].startsWith(prefix) ? 0 : prefix.length;
    totalDelta = newBlock.length - block.length;
  }

  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);

  return {
    value: newValue,
    selectionStart: Math.max(lineStart, selectionStart + deltaFirst),
    selectionEnd: selectionEnd + totalDelta,
  };
}
