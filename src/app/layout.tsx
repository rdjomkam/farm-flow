import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { ImpersonationBanner } from "@/components/users/impersonation-banner";
import { GlobalLoadingProvider } from "@/contexts/global-loading.context";
import { GlobalLoadingBar } from "@/components/ui/global-loading-bar";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getServerSession } from "@/lib/auth";
import { getServerPermissions, getServerSiteModules } from "@/lib/auth/permissions-server";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { Permission, Role, SiteModule } from "@/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FarmFlow",
  description: "Application de suivi d'élevage de silures",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FarmFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0d9488",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  const permissions: Permission[] = session ? await getServerPermissions(session) : [];
  const role: Role | null = session?.role ?? null;
  const siteModules: SiteModule[] = session?.activeSiteId
    ? await getServerSiteModules(session.activeSiteId)
    : [];

  const isImpersonating = session?.isImpersonating ?? false;

  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ToastProvider>
          <GlobalLoadingProvider>
            <GlobalLoadingBar />
            <LoadingOverlay />
            {isImpersonating && session && (
              <ImpersonationBanner
                targetUserName={session.name}
                targetUserRole={session.role}
                originalUserName={session.originalUserName ?? "Administrateur"}
              />
            )}
            {session?.activeSiteId && (
              <SubscriptionBanner siteId={session.activeSiteId} />
            )}
            <div className={isImpersonating ? "pt-14 sm:pt-11" : ""}>
              <AppShell permissions={permissions} role={role} userName={session?.name ?? null} siteModules={siteModules} isImpersonating={isImpersonating}>{children}</AppShell>
            </div>
          </GlobalLoadingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
