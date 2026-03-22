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
import { QueryProvider } from "@/providers/query-provider";
import { getServerSession } from "@/lib/auth";
import { getServerPermissions, getServerSiteModules } from "@/lib/auth/permissions-server";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { Permission, Role, SiteModule } from "@/types";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleSplashLinks } from "@/components/pwa/apple-splash-links";
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
      statusBarStyle: "black-translucent",
      title: "FarmFlow",
    },
    icons: {
      apple: [
        { url: "/apple-touch-icon-180.png", sizes: "180x180" },
        { url: "/apple-touch-icon-152.png", sizes: "152x152" },
        { url: "/apple-touch-icon-120.png", sizes: "120x120" },
        { url: "/apple-touch-icon.png" },
      ],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0d9488", // Sync avec --primary dans globals.css
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  const role: Role | null = session?.role ?? null;
  const isImpersonating = session?.isImpersonating ?? false;

  const [permissions, siteModules, locale, messages] = await Promise.all([
    session ? getServerPermissions(session) : Promise.resolve([] as Permission[]),
    session?.activeSiteId ? getServerSiteModules(session.activeSiteId) : Promise.resolve([] as SiteModule[]),
    getLocale(),
    getMessages(),
  ]);

  return (
    <html lang={locale}>
      <head>
        <AppleSplashLinks />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
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
          </QueryProvider>
        </NextIntlClientProvider>
        <SwRegister />
      </body>
    </html>
  );
}
