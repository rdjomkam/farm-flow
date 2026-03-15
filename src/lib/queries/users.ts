import { prisma } from "@/lib/db";
import type { Role } from "@/types";

// ---------------------------------------------------------------------------
// Utilisateur systeme
// ---------------------------------------------------------------------------

/** Email fixe de l'utilisateur systeme pour les activites auto-generees */
const SYSTEM_USER_EMAIL = "system@dkfarm.internal";

/**
 * Retourne l'utilisateur systeme, le cree s'il n'existe pas encore.
 *
 * Utilise upsert pour etre idempotent et thread-safe.
 * L'utilisateur systeme ne peut pas se connecter (passwordHash = "SYSTEM_NO_LOGIN",
 * isSystem = true).
 */
export async function getOrCreateSystemUser(): Promise<{ id: string }> {
  return prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    create: {
      email: SYSTEM_USER_EMAIL,
      name: "Systeme DKFarm",
      passwordHash: "SYSTEM_NO_LOGIN",
      isSystem: true,
    },
    update: {},
    select: { id: true },
  });
}

/** Find a user by email (for login) */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

/** Find a user by phone (for login) */
export async function getUserByPhone(phone: string) {
  return prisma.user.findUnique({
    where: { phone },
  });
}

/** Find a user by identifier (email or phone) */
export async function getUserByIdentifier(identifier: string) {
  // If starts with + or is all digits, treat as phone
  if (identifier.startsWith("+") || /^\d+$/.test(identifier)) {
    return getUserByPhone(identifier);
  }
  return getUserByEmail(identifier);
}

/** Find a user by ID */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

/** Create a new user (for registration) */
export async function createUser(data: {
  email?: string;
  phone?: string;
  name: string;
  passwordHash: string;
  role?: Role;
}) {
  return prisma.user.create({
    data: {
      ...(data.email && { email: data.email.toLowerCase() }),
      ...(data.phone && { phone: data.phone }),
      name: data.name,
      passwordHash: data.passwordHash,
      ...(data.role && { role: data.role }),
    },
  });
}
