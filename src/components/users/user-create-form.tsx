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
import { useTranslations } from "next-intl";

export function UserCreateForm() {
  const t = useTranslations("users");
  const router = useRouter();
  const userService = useUserService();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [globalRole, setGlobalRole] = useState<Role>(Role.PISCICULTEUR);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ROLE_OPTIONS = [
    { value: Role.PISCICULTEUR, label: t("roles.PISCICULTEUR") },
    { value: Role.GERANT, label: t("roles.GERANT") },
    { value: Role.INGENIEUR, label: t("roles.INGENIEUR") },
    { value: Role.ADMIN, label: t("roles.ADMIN") },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t("form.errors.nomObligatoire");
    }
    if (!email.trim() && !phone.trim()) {
      newErrors.email = t("form.errors.emailOuTelephone");
    }
    if (!password || password.length < 6) {
      newErrors.password = t("form.errors.motDePasseTropCourt");
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
      <FormSection title={t("form.identite")} description={t("form.identiteDescription")}>
        <Input
          id="name"
          label={t("form.nomComplet")}
          placeholder={t("form.nomCompletPlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          id="email"
          label={t("form.email")}
          type="email"
          placeholder={t("form.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          id="phone"
          label={t("form.telephone")}
          type="tel"
          placeholder={t("form.telephonePlaceholder")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
        />
      </FormSection>

      <FormSection title={t("form.acces")} description={t("form.accesDescription")}>
        <Select value={globalRole} onValueChange={(v) => setGlobalRole(v as Role)}>
          <SelectTrigger label={t("form.roleGlobal")}>
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
          label={t("form.motDePasse")}
          type="password"
          placeholder={t("form.motDePassePlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
      </FormSection>

      <Button type="submit" className="w-full">
        {t("form.creerUtilisateur")}
      </Button>
    </form>
  );
}
