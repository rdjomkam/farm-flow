"use client";

import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Fallback rendered when an error is caught.
   * If not provided, the default French fallback UI is shown.
   */
  fallback?: ReactNode;
  /**
   * Optional section label shown in the error message, e.g. "graphique" or "formulaire".
   */
  section?: string;
  /**
   * Optional class applied to the fallback wrapper div.
   */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — composant réutilisable de gestion d'erreurs par section.
 *
 * Wraps a subtree of React components. If any child throws, the error is caught
 * and a French-language fallback UI is shown with a "Réessayer" button.
 *
 * Usage:
 *   <ErrorBoundary section="graphique">
 *     <RechartsChart />
 *   </ErrorBoundary>
 *
 * This is a class component because React error boundaries require
 * `componentDidCatch` / `getDerivedStateFromError`, which are class-only APIs.
 * The "use client" directive is required so it runs in the browser.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for debugging; in production a monitoring service
    // (e.g. Sentry) could be integrated here.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const sectionLabel = this.props.section ?? "cette section";

      return (
        <div className={this.props.className}>
          <ErrorFallback section={sectionLabel} onRetry={this.handleRetry} />
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  section?: string;
  onRetry?: () => void;
}

/**
 * ErrorFallback — UI de repli en français, cohérente avec le design Tailwind + Radix.
 * Peut également être utilisée de manière autonome pour des états d'erreur non-boundary.
 */
export function ErrorFallback({ section = "cette section", onRetry }: ErrorFallbackProps) {
  return (
    <Card className="border-danger/20 bg-danger/5">
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle className="h-6 w-6 text-danger" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            Une erreur est survenue
          </p>
          <p className="text-xs text-muted-foreground">
            Impossible d&apos;afficher {section}. Veuillez réessayer.
          </p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * withErrorBoundary — HOC helper pour wrapper un composant existant facilement.
 *
 * Usage:
 *   const SafeChart = withErrorBoundary(MyChart, { section: "graphique" });
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  boundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";

  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...boundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}
