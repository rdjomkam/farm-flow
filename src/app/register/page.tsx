"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fish, Waves, BarChart3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAuthService } from "@/services";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accept local 9-digit numbers (6XXXXXXXX / 2XXXXXXXX) or full +237 format
const PHONE_REGEX = /^(\+?237)?[62]\d{8}$/;

export default function RegisterPage() {
  const router = useRouter();
  const authService = useAuthService();

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
    if (!name.trim()) newErrors.name = "Le nom est obligatoire.";

    const hasEmail = email.trim().length > 0;
    const hasPhone = phone.trim().length > 0;

    if (!hasEmail && !hasPhone) {
      newErrors.email = "L'email ou le telephone est obligatoire.";
    }
    if (hasEmail && !EMAIL_REGEX.test(email.trim())) {
      newErrors.email = "L'adresse email n'est pas valide.";
    }
    if (hasPhone && !PHONE_REGEX.test(phone.trim())) {
      newErrors.phone = "Format: 6XX XX XX XX ou 2XX XX XX XX.";
    }

    if (!password) newErrors.password = "Le mot de passe est obligatoire.";
    else if (password.length < 6) newErrors.password = "Le mot de passe doit contenir au moins 6 caracteres.";
    if (password !== confirmPassword) newErrors.confirmPassword = "Les mots de passe ne correspondent pas.";

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
        setErrors({ form: errorData?.error || "Erreur lors de l'inscription." });
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
          <p className="text-white/80 mb-8">Gerez vos elevages de silures avec precision et simplicite.</p>
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3 text-white/90">
              <Waves className="h-5 w-5 shrink-0" />
              <span className="text-sm">Suivi des vagues et biometries en temps reel</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <BarChart3 className="h-5 w-5 shrink-0" />
              <span className="text-sm">Analytiques avancees et benchmarks</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <DollarSign className="h-5 w-5 shrink-0" />
              <span className="text-sm">Gestion financiere complete</span>
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
            <CardTitle className="text-xl">Creer un compte</CardTitle>
            <CardDescription>
              Inscrivez-vous pour suivre vos silures
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
                label="Nom complet"
                type="text"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                autoComplete="name"
                autoFocus
              />
              <Input
                label="Email (optionnel)"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                label="Téléphone (optionnel)"
                type="tel"
                placeholder="6XXXXXXXX (+237 ajouté automatiquement)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground -mt-2">
                Au moins un des deux (email ou telephone) est requis.
              </p>
              <Input
                label="Mot de passe"
                type="password"
                placeholder="Minimum 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                placeholder="Retapez votre mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full">
                Creer mon compte
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Deja un compte ?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Se connecter
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
