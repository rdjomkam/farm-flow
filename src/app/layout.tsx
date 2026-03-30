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
import { prisma } from "@/lib/db";
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
  let description = "Application de suivi d'élevage de silures";
  try {
    const t = await getTranslations("common.metadata");
    description = t("appDescription");
  } catch (error: unknown) {
    // Re-throw Next.js internal errors (DYNAMIC_SERVER_USAGE, NEXT_REDIRECT, etc.)
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    // Fallback to hardcoded description
  }
  return {
    title: {
      default: "FarmFlow",
      template: "%s | FarmFlow",
    },
    description,
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
  let permissions: Permission[] = [];
  let siteModules: SiteModule[] = [];
  let locale = "fr";
  let messages: Record<string, unknown> = {};
  let isSuperAdmin = false;
  let session: Awaited<ReturnType<typeof getServerSession>> | null = null;
  let role: Role | null = null;
  let isImpersonating = false;

  try {
    session = await getServerSession();
    role = session?.role ?? null;
    isImpersonating = session?.isImpersonating ?? false;

    const [p, sm, l, m, superAdminUser] = await Promise.all([
      session ? getServerPermissions(session) : ([] as Permission[]),
      session?.activeSiteId ? getServerSiteModules(session.activeSiteId) : ([] as SiteModule[]),
      getLocale(),
      getMessages(),
      session ? prisma.user.findUnique({ where: { id: session.userId }, select: { isSuperAdmin: true } }) : null,
    ]);
    permissions = p;
    siteModules = sm;
    locale = l;
    messages = m as Record<string, unknown>;
    isSuperAdmin = superAdminUser?.isSuperAdmin ?? false;
  } catch (error: unknown) {
    // Re-throw Next.js internal errors (DYNAMIC_SERVER_USAGE, NEXT_REDIRECT, etc.)
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[RootLayout] Failed to load session/messages:", error);
    // Continue with safe defaults — the page will still render
  }

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
              <div className={isImpersonating ? "pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pt-[calc(2.75rem+env(safe-area-inset-top))]" : ""}>
                <AppShell permissions={permissions} role={role} userName={session?.name ?? null} siteModules={siteModules} isImpersonating={isImpersonating} isSuperAdmin={isSuperAdmin} activeSiteId={session?.activeSiteId ?? null}>{children}</AppShell>
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
