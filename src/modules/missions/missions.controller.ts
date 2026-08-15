import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
});

export async function list(_req: AuthenticatedRequest, res: Response) {
  const missions = await prisma.mission.findMany({ orderBy: { name: "asc" } });
  res.json(missions);
}

export async function getBySlug(req: AuthenticatedRequest, res: Response) {
  const mission = await prisma.mission.findUnique({
    where: { slug: req.params.slug },
    include: { groups: true },
  });

  if (!mission) {
    return res.status(404).json({ message: "Missão não encontrada" });
  }

  res.json(mission);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const existing = await prisma.mission.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return res.status(409).json({ message: "Já existe uma missão com esse slug" });
  }

  const mission = await prisma.mission.create({ data: parsed.data });
  res.status(201).json(mission);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const mission = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!mission) {
    return res.status(404).json({ message: "Missão não encontrada" });
  }

  const updated = await prisma.mission.update({ where: { id: mission.id }, data: parsed.data });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const mission = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!mission) {
    return res.status(404).json({ message: "Missão não encontrada" });
  }

  await prisma.mission.delete({ where: { id: mission.id } });
  res.status(204).send();
}

export async function requestToJoin(req: AuthenticatedRequest, res: Response) {
  const mission = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!mission) {
    return res.status(404).json({ message: "Missão não encontrada" });
  }

  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.status(404).json({ message: "Perfil de membro não encontrado" });
  }

  const existing = await prisma.missionRequest.findUnique({
    where: { missionId_memberId: { missionId: mission.id, memberId: member.id } },
  });
  if (existing) {
    return res.status(409).json({ message: "Você já solicitou participação nesta missão" });
  }

  const request = await prisma.missionRequest.create({
    data: { missionId: mission.id, memberId: member.id },
  });

  res.status(201).json(request);
}

export async function listRequests(req: AuthenticatedRequest, res: Response) {
  const requests = await prisma.missionRequest.findMany({
    where: { missionId: req.params.id },
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

  const request = await prisma.missionRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request || request.missionId !== req.params.id) {
    return res.status(404).json({ message: "Solicitação não encontrada" });
  }

  const updated = await prisma.missionRequest.update({
    where: { id: request.id },
    data: { status: parsed.data.status },
  });

  res.json(updated);
}

export async function myRequests(req: AuthenticatedRequest, res: Response) {
  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.json([]);
  }

  const requests = await prisma.missionRequest.findMany({ where: { memberId: member.id } });
  res.json(requests);
}
