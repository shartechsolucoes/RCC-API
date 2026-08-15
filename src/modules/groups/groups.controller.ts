import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  type: z.enum(["MISSION", "MINISTRY", "TEAM"]),
  name: z.string().min(2),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressNeighborhood: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZipCode: z.string().optional(),
  missionId: z.string().optional(),
  ministryId: z.string().optional(),
  coordinatorId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  addressStreet: z.string().nullable().optional(),
  addressNumber: z.string().nullable().optional(),
  addressNeighborhood: z.string().nullable().optional(),
  addressCity: z.string().nullable().optional(),
  addressState: z.string().nullable().optional(),
  addressZipCode: z.string().nullable().optional(),
  coordinatorId: z.string().nullable().optional(),
});

function isTopManager(req: AuthenticatedRequest) {
  return req.profileLevel === "ROOT" || req.profileLevel === "COORDENACAO_GERAL";
}

async function isCoordinatorOrRoot(req: AuthenticatedRequest, groupId: string) {
  if (isTopManager(req)) return true;

  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) return false;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  return group?.coordinatorId === member.id;
}

export async function list(req: AuthenticatedRequest, res: Response) {
  const missionId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
  const ministryId = typeof req.query.ministryId === "string" ? req.query.ministryId : undefined;
  const isRoot = req.profileLevel === "ROOT";

  const groups = await prisma.group.findMany({
    where: { missionId, ministryId, isActive: isRoot ? undefined : true },
    include: {
      coordinator: { select: { id: true, fullName: true, photoUrl: true } },
      mission: { select: { id: true, name: true } },
      ministry: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  res.json(groups);
}

export async function getById(req: AuthenticatedRequest, res: Response) {
  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: {
      coordinator: { select: { id: true, fullName: true, photoUrl: true } },
      mission: { select: { id: true, name: true } },
      ministry: { select: { id: true, name: true } },
      members: { include: { member: { select: { id: true, fullName: true, photoUrl: true } } } },
    },
  });

  if (!group || (!group.isActive && req.profileLevel !== "ROOT")) {
    return res.status(404).json({ message: "Fraternidade não encontrada" });
  }

  res.json(group);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  if (!parsed.data.missionId && !parsed.data.ministryId) {
    return res.status(400).json({ message: "Informe a missão ou o ministério da fraternidade" });
  }

  const group = await prisma.group.create({ data: parsed.data });
  res.status(201).json(group);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ message: "Fraternidade não encontrada" });
  }

  const allowed = await isCoordinatorOrRoot(req, group.id);
  if (!allowed) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const { coordinatorId, ...rest } = parsed.data;
  const data: typeof rest & { coordinatorId?: string | null } = { ...rest };
  if (coordinatorId !== undefined && isTopManager(req)) {
    data.coordinatorId = coordinatorId;
  }

  const updated = await prisma.group.update({ where: { id: group.id }, data });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ message: "Fraternidade não encontrada" });
  }

  await prisma.$transaction([
    prisma.group.update({ where: { id: group.id }, data: { isActive: false } }),
    prisma.event.updateMany({ where: { groupId: group.id }, data: { isActive: false } }),
  ]);

  res.status(204).send();
}

export async function requestToJoin(req: AuthenticatedRequest, res: Response) {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ message: "Fraternidade não encontrada" });
  }

  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.status(404).json({ message: "Perfil de membro não encontrado" });
  }

  const existingMembership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: group.id, memberId: member.id } },
  });
  if (existingMembership) {
    return res.status(409).json({ message: "Você já faz parte desta fraternidade" });
  }

  const existing = await prisma.groupRequest.findFirst({
    where: { groupId: group.id, memberId: member.id, status: "PENDING" },
  });
  if (existing) {
    return res.status(409).json({ message: "Você já solicitou participação nesta fraternidade" });
  }

  const request = await prisma.groupRequest.create({
    data: { groupId: group.id, memberId: member.id },
  });

  res.status(201).json(request);
}

export async function listRequests(req: AuthenticatedRequest, res: Response) {
  const allowed = await isCoordinatorOrRoot(req, req.params.id);
  if (!allowed) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const requests = await prisma.groupRequest.findMany({
    where: { groupId: req.params.id },
    include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
    orderBy: { requestedAt: "desc" },
  });
  res.json(requests);
}

const requestStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function updateRequestStatus(req: AuthenticatedRequest, res: Response) {
  const parsed = requestStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const allowed = await isCoordinatorOrRoot(req, req.params.id);
  if (!allowed) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const request = await prisma.groupRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request || request.groupId !== req.params.id) {
    return res.status(404).json({ message: "Solicitação não encontrada" });
  }

  const updated = await prisma.groupRequest.update({
    where: { id: request.id },
    data: { status: parsed.data.status },
  });

  if (parsed.data.status === "APPROVED") {
    await prisma.groupMember.upsert({
      where: { groupId_memberId: { groupId: request.groupId, memberId: request.memberId } },
      create: { groupId: request.groupId, memberId: request.memberId },
      update: {},
    });
  }

  res.json(updated);
}

export async function removeMember(req: AuthenticatedRequest, res: Response) {
  const allowed = await isCoordinatorOrRoot(req, req.params.id);
  if (!allowed) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_memberId: { groupId: req.params.id, memberId: req.params.memberId } },
  });
  if (!membership) {
    return res.status(404).json({ message: "Membro não encontrado nesta fraternidade" });
  }

  await prisma.groupMember.delete({ where: { id: membership.id } });
  res.status(204).send();
}

export async function myGroups(req: AuthenticatedRequest, res: Response) {
  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.json([]);
  }

  const groups = await prisma.group.findMany({
    where: {
      isActive: true,
      OR: [{ coordinatorId: member.id }, { members: { some: { memberId: member.id } } }],
    },
    include: {
      mission: { select: { id: true, name: true } },
      ministry: { select: { id: true, name: true } },
      coordinator: { select: { id: true, fullName: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  res.json(
    groups.map((g) => ({ ...g, isCoordinator: g.coordinatorId === member.id })),
  );
}

export async function myRequests(req: AuthenticatedRequest, res: Response) {
  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.json([]);
  }

  const requests = await prisma.groupRequest.findMany({ where: { memberId: member.id } });
  res.json(requests);
}
