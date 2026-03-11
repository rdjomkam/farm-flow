import { prisma } from "@/lib/db";
import type { Role } from "@/types";

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
