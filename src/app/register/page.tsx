"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fish, Waves, BarChart3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAuthService } from "@/services";
import { useTranslations } from "next-intl";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accept local 9-digit numbers (6XXXXXXXX / 2XXXXXXXX) or full +237 format
const PHONE_REGEX = /^(\+?237)?[62]\d{8}$/;

export default function RegisterPage() {
  const router = useRouter();
  const authService = useAuthService();
  const t = useTranslations("common.register");
  const tLogin = useTranslations("common.login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t("errorNameRequired");

    const hasEmail = email.trim().length > 0;
    const hasPhone = phone.trim().length > 0;

    if (!hasEmail && !hasPhone) {
      newErrors.email = t("errorEmailOrPhoneRequired");
    }
    if (hasEmail && !EMAIL_REGEX.test(email.trim())) {
      newErrors.email = t("errorEmailInvalid");
    }
    if (hasPhone && !PHONE_REGEX.test(phone.trim())) {
      newErrors.phone = t("errorPhoneInvalid");
    }

    if (!password) newErrors.password = t("errorPasswordRequired");
    else if (password.length < 6) newErrors.password = t("errorPasswordTooShort");
    if (password !== confirmPassword) newErrors.confirmPassword = t("errorPasswordMismatch");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Normaliser le numéro de téléphone camerounais : 6XXXXXXXX → +2376XXXXXXXX
    let normalizedPhone = phone.trim();
    if (hasPhone && /^[67]\d{8}$/.test(normalizedPhone)) {
      normalizedPhone = `+237${normalizedPhone}`;
    }

    const { ok, data } = await authService.register({
      name: name.trim(),
      ...(hasEmail && { email: email.trim() }),
      ...(hasPhone && { phone: normalizedPhone }),
      password,
    });

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

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh bg-surface-0">
      {/* Left brand panel - desktop only */}
      <div className="hidden md:flex md:w-1/2 md:flex-col md:justify-center md:items-center md:p-12 relative overflow-hidden" style={{ background: "var(--primary-gradient)" }}>
        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm mb-6">
            <Fish className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">FarmFlow</h1>
          <p className="text-white/80 mb-8">{tLogin("brandTagline")}</p>
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3 text-white/90">
              <Waves className="h-5 w-5 shrink-0" />
              <span className="text-sm">{tLogin("feature1")}</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <BarChart3 className="h-5 w-5 shrink-0" />
              <span className="text-sm">{tLogin("feature2")}</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <DollarSign className="h-5 w-5 shrink-0" />
              <span className="text-sm">{tLogin("feature3")}</span>
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
                label={t("fieldName")}
                type="text"
                placeholder={t("fieldNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                autoComplete="name"
                autoFocus
              />
              <Input
                label={t("fieldEmail")}
                type="email"
                placeholder={t("fieldEmailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                label={t("fieldPhone")}
                type="tel"
                placeholder={t("fieldPhonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground -mt-2">
                {t("fieldEmailOrPhoneHint")}
              </p>
              <Input
                label={t("fieldPassword")}
                type="password"
                placeholder={t("fieldPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
              />
              <Input
                label={t("fieldConfirmPassword")}
                type="password"
                placeholder={t("fieldConfirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full">
                {t("submitButton")}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {t("alreadyAccount")}{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  {t("signIn")}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
