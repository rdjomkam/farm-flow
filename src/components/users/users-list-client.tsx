"use client";

import { useState } from "react";
import { UserCard } from "./user-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { Role } from "@/types";

interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  siteCount: number;
  createdAt: string;
}

interface UsersListClientProps {
  users: UserSummary[];
  currentUserId: string;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les roles" },
  { value: Role.ADMIN, label: "Administrateur global" },
  { value: Role.GERANT, label: "Gerant" },
  { value: Role.PISCICULTEUR, label: "Pisciculteur" },
  { value: Role.INGENIEUR, label: "Ingenieur" },
];

export function UsersListClient({ users, currentUserId }: UsersListClientProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = users.filter((u) => {
    if (u.id === currentUserId) return false; // optionally keep current user visible

    // Role filter
    if (roleFilter !== "all" && u.globalRole !== roleFilter) return false;

    // Search filter (name, email, phone)
    if (search.trim() !== "") {
      const term = search.trim().toLowerCase();
      const matchName = u.name.toLowerCase().includes(term);
      const matchEmail = u.email?.toLowerCase().includes(term) ?? false;
      const matchPhone = u.phone?.toLowerCase().includes(term) ?? false;
      if (!matchName && !matchEmail && !matchPhone) return false;
    }

    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            id="search-users"
            label="Rechercher"
            placeholder="Nom, email ou telephone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger label="Role">
              <SelectValue placeholder="Tous les roles" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} utilisateur{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Aucun utilisateur"
          description="Aucun utilisateur ne correspond a ce filtre."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}
