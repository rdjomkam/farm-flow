"use client";

// NOTE: global-error.tsx renders outside the Next-intl provider context.
// useTranslations() cannot be used here. Strings are kept as static constants
// that mirror the keys in src/messages/*/errors.json (global.fallback, etc.).
const STRINGS = {
  criticalTitle: "Une erreur critique est survenue",
  fallback: "Quelque chose s'est mal passé. Veuillez réessayer.",
  ref: "Réf:",
  retry: "Réessayer",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "50%",
              backgroundColor: "#fef2f2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: "bold",
            }}
          >
            !
          </div>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
              {STRINGS.criticalTitle}
            </h2>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
              {error.message || STRINGS.fallback}
            </p>
            {error.digest && (
              <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                {STRINGS.ref} {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              backgroundColor: "#f9fafb",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {STRINGS.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
