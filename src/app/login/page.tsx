"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Fish, Waves, BarChart3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAuthService } from "@/services";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const authService = useAuthService();
  const t = useTranslations("common.login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!identifier.trim()) newErrors.identifier = t("errorIdentifierRequired");
    if (!password) newErrors.password = t("errorPasswordRequired");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Normaliser le numéro de téléphone camerounais : 6XXXXXXXX → +2376XXXXXXXX
    let normalizedIdentifier = identifier.trim();
    if (/^[67]\d{8}$/.test(normalizedIdentifier)) {
      normalizedIdentifier = `+237${normalizedIdentifier}`;
    }

    const { ok, data } = await authService.login({ identifier: normalizedIdentifier, password });

    if (!ok) {
      const errorData = data as { errors?: { field: string; message: string }[]; error?: string } | null;
      if (errorData?.errors) {
        const fieldErrors: Record<string, string> = {};
        for (const err of errorData.errors) {
          fieldErrors[err.field] = err.message;
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ form: errorData?.error || t("errorGeneric") });
      }
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh bg-surface-0 relative">
      {/* Language switcher — top-right, accessible on all viewports */}
      <div className="absolute top-3 right-3 z-10">
        <LanguageSwitcher />
      </div>

      {/* Left brand panel - desktop only */}
      <div className="hidden md:flex md:w-1/2 md:flex-col md:justify-center md:items-center md:p-12 relative overflow-hidden" style={{ background: "var(--primary-gradient)" }}>
        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm mb-6">
            <Fish className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">FarmFlow</h1>
          <p className="text-white/80 mb-8">{t("brandTagline")}</p>
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3 text-white/90">
              <Waves className="h-5 w-5 shrink-0" />
              <span className="text-sm">{t("feature1")}</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <BarChart3 className="h-5 w-5 shrink-0" />
              <span className="text-sm">{t("feature2")}</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <DollarSign className="h-5 w-5 shrink-0" />
              <span className="text-sm">{t("feature3")}</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -left-8 bottom-16 h-40 w-40 rounded-full bg-white/5" />
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {/* Mobile branding */}
        <div className="flex flex-col items-center mb-6 md:hidden">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-3" style={{ background: "var(--primary-gradient)" }}>
            <Fish className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold">FarmFlow</h1>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <CardDescription>
              {t("subtitle")}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              {errors.form && (
                <p className="text-sm text-danger text-center rounded-lg bg-danger/10 p-3">
                  {errors.form}
                </p>
              )}
              <Input
                label={t("fieldIdentifier")}
                type="text"
                placeholder={t("fieldIdentifierPlaceholder")}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                error={errors.identifier}
                autoComplete="username"
                autoFocus
              />
              <Input
                label={t("fieldPassword")}
                type="password"
                placeholder={t("fieldPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="current-password"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full">
                {t("submitButton")}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {t("noAccount")}{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  {t("createAccount")}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
