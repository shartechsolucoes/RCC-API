import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
  order: z.number().int().optional(),
  groupId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

function isTopManager(req: AuthenticatedRequest) {
  return req.profileLevel === "ROOT" || req.profileLevel === "COORDENACAO_GERAL";
}

// Tipo global (groupId nulo): apenas coordenação geral / root.
// Tipo de uma fraternidade: coordenação geral / root ou o coordenador daquela fraternidade.
async function canManage(req: AuthenticatedRequest, groupId: string | null) {
  if (isTopManager(req)) return true;
  if (!groupId) return false;

  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) return false;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  return group?.coordinatorId === member.id;
}

// GET /team-types?groupId=xxx  -> tipos globais + os da fraternidade informada
// GET /team-types?scope=global -> somente os globais
// GET /team-types              -> todos
export async function list(req: AuthenticatedRequest, res: Response) {
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;

  let where: Record<string, unknown> = {};
  if (scope === "global") {
    where = { groupId: null };
  } else if (groupId) {
    where = { OR: [{ groupId: null }, { groupId }] };
  }

  const teamTypes = await prisma.teamType.findMany({
    where,
    include: { group: { select: { id: true, name: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  res.json(teamTypes);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const groupId = parsed.data.groupId ?? null;

  if (!(await canManage(req, groupId))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ message: "Fraternidade não encontrada" });
    }
  }

  const duplicate = await prisma.teamType.findFirst({
    where: { groupId, name: parsed.data.name },
  });
  if (duplicate) {
    return res.status(409).json({ message: "Já existe um tipo de equipe com esse nome" });
  }

  const teamType = await prisma.teamType.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      order: parsed.data.order ?? 0,
      groupId,
    },
  });

  res.status(201).json(teamType);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const teamType = await prisma.teamType.findUnique({ where: { id: req.params.id } });
  if (!teamType) {
    return res.status(404).json({ message: "Tipo de equipe não encontrado" });
  }

  if (!(await canManage(req, teamType.groupId))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  if (parsed.data.name && parsed.data.name !== teamType.name) {
    const duplicate = await prisma.teamType.findFirst({
      where: { groupId: teamType.groupId, name: parsed.data.name, id: { not: teamType.id } },
    });
    if (duplicate) {
      return res.status(409).json({ message: "Já existe um tipo de equipe com esse nome" });
    }
  }

  const updated = await prisma.teamType.update({
    where: { id: teamType.id },
    data: parsed.data,
  });

  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const teamType = await prisma.teamType.findUnique({ where: { id: req.params.id } });
  if (!teamType) {
    return res.status(404).json({ message: "Tipo de equipe não encontrado" });
  }

  if (!(await canManage(req, teamType.groupId))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  await prisma.teamType.delete({ where: { id: teamType.id } });
  res.status(204).send();
}
