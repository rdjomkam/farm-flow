import { cn } from "@/lib/utils";

interface SilureLogoProps {
  className?: string;
  size?: number;
}

/**
 * SilureLogo — Silhouette de silure (Clarias gariepinus) SVG inline.
 * Utilise `currentColor` pour s'adapter au thème (text-primary, etc.).
 * ViewBox 32x32, optimise pour 20px-32px.
 */
export function SilureLogo({ className, size = 24 }: SilureLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* Corps principal */}
      <ellipse cx="15" cy="17" rx="12" ry="7" fill="currentColor" opacity="0.9" />
      {/* Tete arrondie */}
      <circle cx="25" cy="17" r="5.5" fill="currentColor" />
      {/* Queue bifurquee */}
      <path d="M3 17 L0 10 L4 17 L0 24 Z" fill="currentColor" opacity="0.85" />
      {/* Nageoire dorsale */}
      <path d="M13 10 Q18 6 23 9 L23 11 Q18 8 13 12 Z" fill="currentColor" opacity="0.7" />
      {/* Nageoire pectorale */}
      <path d="M22 20 Q26 24 23 26 L22 23 Z" fill="currentColor" opacity="0.65" />
      {/* Barbillon 1 (haut) */}
      <path d="M27 14 Q31 10 30 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* Barbillon 2 (haut court) */}
      <path d="M28 15 Q32 12 31 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* Barbillon 3 (bas) */}
      <path d="M27 19 Q31 23 30 25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* Barbillon 4 (bas court) */}
      <path d="M28 18 Q32 21 31 23" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* Oeil */}
      <circle cx="27" cy="15" r="1.4" fill="white" />
      <circle cx="27.4" cy="15" r="0.7" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
