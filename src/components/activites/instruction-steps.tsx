import { parseInstructions } from "@/lib/parse-instructions";

interface InstructionStepsProps {
  text: string;
}

export function InstructionSteps({ text }: InstructionStepsProps) {
  const blocks = parseInstructions(text);

  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        if (block.type === "step") {
          return (
            <div key={i} className="flex gap-3 items-start">
              <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {block.number}
              </span>
              <p className="text-sm leading-relaxed text-foreground pt-0.5">{block.text}</p>
            </div>
          );
        }
        if (block.type === "heading") {
          return (
            <p key={i} className="text-sm font-semibold text-foreground mt-2 first:mt-0">{block.text}</p>
          );
        }
        if (block.type === "bullet") {
          return (
            <div key={i} className="flex gap-2.5 items-start pl-1">
              <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5" />
              <p className="text-sm leading-relaxed text-foreground">{block.text}</p>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
        );
      })}
    </div>
  );
}
