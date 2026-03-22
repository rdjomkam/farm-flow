/**
 * src/app/backoffice/page.tsx
 *
 * Redirection vers /backoffice/dashboard.
 * Story C.1 — ADR-022 Backoffice
 */

import { redirect } from "next/navigation";

export default function BackofficePage() {
  redirect("/backoffice/dashboard");
}
