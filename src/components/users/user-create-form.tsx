"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "@/types";
import { useUserService } from "@/services";

const ROLE_OPTIONS = [
  { value: Role.PISCICULTEUR, label: "Pisciculteur" },
  { value: Role.GERANT, label: "Gerant" },
  { value: Role.INGENIEUR, label: "Ingenieur" },
  { value: Role.ADMIN, label: "Administrateur global" },
];

export function UserCreateForm() {
  const router = useRouter();
  const userService = useUserService();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [globalRole, setGlobalRole] = useState<Role>(Role.PISCICULTEUR);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Le nom est obligatoire.";
    }
    if (!email.trim() && !phone.trim()) {
      newErrors.email = "Email ou telephone est requis.";
    }
    if (!password || password.length < 6) {
      newErrors.password = "Le mot de passe doit contenir au moins 6 caracteres.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const { ok, data } = await userService.createUser({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      password,
      globalRole,
    });

    if (!ok) {
      const errorData = data as { errors?: { field: string; message: string }[] } | null;
      if (errorData?.errors) {
        const fieldErrors: Record<string, string> = {};
        for (const err of errorData.errors) {
          fieldErrors[err.field] = err.message;
        }
        setErrors(fieldErrors);
      }
      return;
    }

    if (data) {
      router.push(`/users/${(data as { id: string }).id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection title="Identite" description="Informations de base de l'utilisateur">
        <Input
          id="name"
          label="Nom complet"
          placeholder="Ex : Jean Dupont"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          id="email"
          label="Adresse email (optionnel si telephone renseigne)"
          type="email"
          placeholder="jean@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          id="phone"
          label="Telephone (optionnel si email renseigne)"
          type="tel"
          placeholder="+237 6XX XX XX XX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
        />
      </FormSection>

      <FormSection title="Acces" description="Role et mot de passe de connexion">
        <Select value={globalRole} onValueChange={(v) => setGlobalRole(v as Role)}>
          <SelectTrigger label="Role global">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id="password"
          label="Mot de passe (min. 6 caracteres)"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
      </FormSection>

      <Button type="submit" className="w-full">
        Creer l'utilisateur
      </Button>
    </form>
  );
}
