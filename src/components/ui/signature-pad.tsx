"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignaturePadHandle {
  /** Exporte le contenu du canvas en data URL PNG (null si vide) */
  toDataURL: () => string | null;
  /** Efface le trait */
  clear: () => void;
}

interface SignaturePadProps {
  /** Hauteur du canvas en px — defaut 200 */
  height?: number;
  /** Appele a chaque changement d'etat vide/non-vide */
  onChangeEmpty?: (isEmpty: boolean) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * SignaturePad — zone de signature tactile (canvas natif, pas de lib externe).
 *
 * Supporte souris + doigt (pointer events, couvre pointerdown/move/up).
 * Trait lisse (lineJoin/lineCap round, largeur ~2.5). DPR-aware pour eviter
 * le flou sur ecrans retina/mobile haute densite.
 *
 * Le parent recupere le contenu via `ref.current.toDataURL()` et peut
 * effacer via `ref.current.clear()`. L'etat vide est aussi remonte via
 * `onChangeEmpty` pour desactiver le bouton "Valider" tant que rien n'est
 * dessine.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ height = 200, onChangeEmpty, className }, ref) {
    const t = useTranslations("common.signaturePad");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const getContext = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.getContext("2d");
    }, []);

    // Redimensionne le canvas selon le devicePixelRatio pour un trait net
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth || 300;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "var(--foreground)";
    }, [height]);

    useEffect(() => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function setEmpty(value: boolean) {
      setIsEmpty(value);
      onChangeEmpty?.(value);
    }

    function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture?.(e.pointerId);
      drawingRef.current = true;
      lastPointRef.current = getPoint(e);
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current) return;
      e.preventDefault();
      const ctx = getContext();
      if (!ctx || !lastPointRef.current) return;

      const point = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;

      if (isEmpty) setEmpty(false);
    }

    function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      drawingRef.current = false;
      lastPointRef.current = null;
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }

    function handleClear() {
      const canvas = canvasRef.current;
      const ctx = getContext();
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      setEmpty(true);
    }

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: () => {
          const canvas = canvasRef.current;
          if (!canvas || isEmpty) return null;
          return canvas.toDataURL("image/png");
        },
        clear: handleClear,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isEmpty]
    );

    return (
      <div className={className}>
        <div
          ref={containerRef}
          data-testid="signature-pad-container"
          className="w-full rounded-lg border border-border bg-[var(--background)] overflow-hidden touch-none"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={t("ariaLabel")}
            data-testid="signature-pad-canvas"
            className="w-full h-full touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            {isEmpty ? t("emptyHint") : t("filledHint")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isEmpty}
          >
            <Eraser className="h-4 w-4" />
            {t("clear")}
          </Button>
        </div>
      </div>
    );
  }
);
