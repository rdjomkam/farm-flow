/**
 * Parses raw instruction text (markdown or plain) into structured blocks
 * for rendering as step cards instead of raw markdown.
 */

export type InstructionBlock =
  | { type: "step"; number: number; text: string }
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "paragraph"; text: string };

/** Strip **bold** and *italic* markers from text */
function stripFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1");
}

export function parseInstructions(raw: string): InstructionBlock[] {
  const lines = raw.split("\n");
  const blocks: InstructionBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Numbered step: "1. Some text"
    const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (stepMatch) {
      blocks.push({
        type: "step",
        number: parseInt(stepMatch[1], 10),
        text: stripFormatting(stepMatch[2]),
      });
      continue;
    }

    // Heading: "## Some text"
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: "heading", text: stripFormatting(headingMatch[1]) });
      continue;
    }

    // Bullet: "- Some text" or "* Some text"
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      blocks.push({ type: "bullet", text: stripFormatting(bulletMatch[1]) });
      continue;
    }

    // Paragraph: anything else
    blocks.push({ type: "paragraph", text: stripFormatting(trimmed) });
  }

  return blocks;
}
