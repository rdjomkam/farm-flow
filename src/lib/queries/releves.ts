import { prisma } from "@/lib/db";
import { StatutVague } from "@/types";
import type { CreateReleveDTO, ReleveFilters, TypeReleve } from "@/types";

/** Liste les releves avec filtres optionnels */
export async function getReleves(filters: ReleveFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.vagueId) where.vagueId = filters.vagueId;
  if (filters.bacId) where.bacId = filters.bacId;
  if (filters.typeReleve) where.typeReleve = filters.typeReleve;

  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
    };
  }

  const releves = await prisma.releve.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return { releves, total: releves.length };
}

/** Cree un releve (verifie que le bac appartient a la vague) */
export async function createReleve(data: CreateReleveDTO) {
  // Verifier que le bac appartient a la vague
  const bac = await prisma.bac.findUnique({
    where: { id: data.bacId },
  });

  if (!bac) {
    throw new Error("Bac introuvable");
  }

  if (bac.vagueId !== data.vagueId) {
    throw new Error("Ce bac n'appartient pas à la vague sélectionnée");
  }

  // Verifier que la vague existe et est en cours
  const vague = await prisma.vague.findUnique({
    where: { id: data.vagueId },
  });

  if (!vague) {
    throw new Error("Vague introuvable");
  }

  if (vague.statut !== StatutVague.EN_COURS) {
    throw new Error("Impossible d'ajouter un relevé à une vague clôturée");
  }

  // Construire les donnees selon le type
  return prisma.releve.create({
    data: {
      date: new Date(data.date),
      typeReleve: data.typeReleve,
      vagueId: data.vagueId,
      bacId: data.bacId,
      notes: data.notes ?? null,
      // Champs biometrie
      ...("poidsMoyen" in data && { poidsMoyen: data.poidsMoyen }),
      ...("tailleMoyenne" in data && { tailleMoyenne: data.tailleMoyenne }),
      ...("echantillonCount" in data && {
        echantillonCount: data.echantillonCount,
      }),
      // Champs mortalite
      ...("nombreMorts" in data && { nombreMorts: data.nombreMorts }),
      ...("causeMortalite" in data && {
        causeMortalite: data.causeMortalite,
      }),
      // Champs alimentation
      ...("quantiteAliment" in data && {
        quantiteAliment: data.quantiteAliment,
      }),
      ...("typeAliment" in data && { typeAliment: data.typeAliment }),
      ...("frequenceAliment" in data && {
        frequenceAliment: data.frequenceAliment,
      }),
      // Champs qualite eau
      ...("temperature" in data && { temperature: data.temperature }),
      ...("ph" in data && { ph: data.ph }),
      ...("oxygene" in data && { oxygene: data.oxygene }),
      ...("ammoniac" in data && { ammoniac: data.ammoniac }),
      // Champs comptage
      ...("nombreCompte" in data && { nombreCompte: data.nombreCompte }),
      ...("methodeComptage" in data && {
        methodeComptage: data.methodeComptage,
      }),
      // Champs observation
      ...("description" in data && { description: data.description }),
    },
  });
}

/** Recupere les releves d'une vague filtres par type */
export async function getRelevesByType(vagueId: string, type: TypeReleve) {
  return prisma.releve.findMany({
    where: { vagueId, typeReleve: type },
    orderBy: { date: "desc" },
  });
}
