"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Fish, Waves, BarChart3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!identifier.trim()) newErrors.identifier = "L'email ou le telephone est obligatoire.";
    if (!password) newErrors.password = "Le mot de passe est obligatoire.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Normaliser le numéro de téléphone camerounais : 6XXXXXXXX → +2376XXXXXXXX
      let normalizedIdentifier = identifier.trim();
      if (/^[67]\d{8}$/.test(normalizedIdentifier)) {
        normalizedIdentifier = `+237${normalizedIdentifier}`;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedIdentifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          const fieldErrors: Record<string, string> = {};
          for (const err of data.errors) {
            fieldErrors[err.field] = err.message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ form: data.error || "Erreur de connexion." });
        }
        return;
      }

      toast({ title: "Connexion réussie", variant: "success" });
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setErrors({ form: "Erreur réseau. Vérifiez votre connexion." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-surface-0">
      {/* Left brand panel - desktop only */}
      <div className="hidden md:flex md:w-1/2 md:flex-col md:justify-center md:items-center md:p-12 relative overflow-hidden" style={{ background: "var(--primary-gradient)" }}>
        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm mb-6">
            <Fish className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Suivi Silures</h1>
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
          <h1 className="text-xl font-bold">Suivi Silures</h1>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Connexion</CardTitle>
            <CardDescription>
              Connectez-vous a votre compte Suivi Silures
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
                label="Email ou téléphone"
                type="text"
                placeholder="votre@email.com ou 6XXXXXXXX (+237 ajouté automatiquement)"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                error={errors.identifier}
                autoComplete="username"
                autoFocus
              />
              <Input
                label="Mot de passe"
                type="password"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="current-password"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Pas encore de compte ?{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Creer un compte
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
