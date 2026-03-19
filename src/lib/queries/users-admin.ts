import { prisma } from "@/lib/db";
import { Role } from "@/types";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

export interface UserWithSiteCount {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  siteCount: number;
}

export interface UserAdminDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMembershipItem {
  id: string;
  siteId: string;
  siteName: string;
  siteRoleId: string;
  siteRoleName: string;
  isActive: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Lister les utilisateurs avec filtres et pagination (exclut isSystem) */
export async function listUsers(filters: {
  search?: string;
  role?: Role;
  isActive?: boolean;
  page: number;
  limit: number;
}): Promise<{ users: UserWithSiteCount[]; total: number }> {
  const { search, role, isActive, page, limit } = filters;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = { isSystem: false };

  if (role) {
    where.role = role;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search && search.trim() !== "") {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ];
  }

  const [rawUsers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isSystem: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const users: UserWithSiteCount[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    globalRole: u.role as Role,
    isActive: u.isActive,
    isSystem: u.isSystem,
    createdAt: u.createdAt,
    siteCount: u._count.memberships,
  }));

  return { users, total };
}

/** Profil complet d'un utilisateur (admin, exclut passwordHash) */
export async function getUserAdminDetail(id: string): Promise<UserAdminDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    globalRole: user.role as Role,
    isActive: user.isActive,
    isSystem: user.isSystem,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Mettre a jour le profil d'un utilisateur */
export async function updateUserAdmin(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    globalRole?: Role;
    isActive?: boolean;
  }
): Promise<UserAdminDetail> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email.toLowerCase() }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.globalRole !== undefined && { role: data.globalRole }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    globalRole: user.role as Role,
    isActive: user.isActive,
    isSystem: user.isSystem,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Compter les ADMIN actifs (pour empecher la desactivation du dernier) */
export async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      isSystem: false,
    },
  });
}

/** Lister les memberships d'un utilisateur */
export async function getUserMemberships(userId: string): Promise<UserMembershipItem[]> {
  const memberships = await prisma.siteMember.findMany({
    where: { userId },
    include: {
      site: { select: { name: true } },
      siteRole: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return memberships.map((m) => ({
    id: m.id,
    siteId: m.siteId,
    siteName: m.site.name,
    siteRoleId: m.siteRoleId,
    siteRoleName: m.siteRole.name,
    isActive: m.isActive,
    createdAt: m.createdAt,
  }));
}
