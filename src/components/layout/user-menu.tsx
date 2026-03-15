"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Role } from "@/types";
import type { UserSession } from "@/types";

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  GERANT: "Gerant",
  PISCICULTEUR: "Pisciculteur",
  INGENIEUR: "Ingénieur",
};

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {
        // Not logged in
      });
  }, []);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex sm:flex-col sm:items-end sm:text-right">
        <span className="text-sm font-medium truncate max-w-[120px]">
          {user.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {roleLabels[user.role] ?? user.role}
        </span>
        {(user.email || user.phone) && (
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
            {user.email ?? user.phone}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary",
            "sm:hidden"
          )}
        >
          <User className="h-4 w-4" />
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className={cn(
            "flex items-center justify-center rounded-lg p-2 text-muted-foreground",
            "hover:bg-muted hover:text-foreground transition-colors",
            "min-h-[44px] min-w-[44px]",
            "disabled:opacity-50"
          )}
          aria-label="Se deconnecter"
          title="Se deconnecter"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
