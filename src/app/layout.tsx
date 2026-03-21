import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");
  return {
    title: {
      default: "FarmFlow",
      template: "%s | FarmFlow",
    },
    description: t("appDescription"),
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "FarmFlow",
    },
  };
}

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

  // Detect locale and load messages for next-intl
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
