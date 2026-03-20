import { cn } from "@/lib/utils";

interface FishLoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

/**
 * FishLoader — Silure (Clarias gariepinus) anime.
 * - sm : wiggle en place — pour boutons
 * - md : nage gauche-droite — pour dialogs/cartes
 * - lg : nage lente grande — pour pages entieres
 */
export function FishLoader({ size = "md", text, className }: FishLoaderProps) {
  const sizeMap = {
    sm: { width: 16, height: 16, containerClass: "inline-flex items-center" },
    md: { width: 32, height: 32, containerClass: "flex flex-col items-center justify-center" },
    lg: { width: 64, height: 64, containerClass: "flex flex-col items-center justify-center" },
  };

  const { width, height, containerClass } = sizeMap[size];

  const animClass = size === "sm" ? "animate-fish-wiggle" : "animate-fish-swim";

  const svgEl = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("text-primary", animClass, size !== "sm" && "block")}
    >
      {/* Corps principal — ellipse allongee */}
      <ellipse cx="32" cy="17" rx="22" ry="10" fill="currentColor" opacity="0.9" />

      {/* Tete arrondie */}
      <ellipse cx="52" cy="17" rx="8" ry="8" fill="currentColor" />

      {/* Queue bifurquee (gauche) */}
      <path
        d="M10 17 L2 8 L6 17 L2 26 Z"
        fill="currentColor"
        opacity="0.85"
      />

      {/* Nageoire dorsale */}
      <path
        d="M28 7 Q35 1 44 6 L44 8 Q35 4 28 9 Z"
        fill="currentColor"
        opacity="0.7"
      />

      {/* Nageoire pectorale */}
      <path
        d="M42 19 Q48 24 44 27 L42 24 Z"
        fill="currentColor"
        opacity="0.65"
      />

      {/* Barbillon 1 (long) */}
      <path
        d="M57 15 Q63 11 62 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* Barbillon 2 */}
      <path
        d="M59 16 Q65 14 64 12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* Barbillon 3 (bas gauche) */}
      <path
        d="M57 18 Q63 22 62 25"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* Barbillon 4 (bas droite) */}
      <path
        d="M59 17 Q65 20 65 23"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* Oeil */}
      <circle cx="54" cy="15" r="1.8" fill="white" />
      <circle cx="54.5" cy="15" r="0.9" fill="currentColor" opacity="0.5" />
    </svg>
  );

  if (size === "sm") {
    return (
      <span className={cn(containerClass, className)}>
        {svgEl}
      </span>
    );
  }

  return (
    <div className={cn(containerClass, "overflow-hidden", className)}>
      <div className="relative w-full">
        {svgEl}
      </div>
      {text && (
        <span className="mt-2 text-sm text-muted-foreground">{text}</span>
      )}
    </div>
  );
}
