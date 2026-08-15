import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const MANAGER_PROFILES = ["COORDENADOR", "COORDENACAO_GERAL", "ROOT"];

const updateSchema = z.object({
  fullName: z.string().min(3).optional(),
  phone: z.string().optional(),
  photoUrl: z.string().url().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  birthDate: z.string().datetime().optional(),
});

const userSelect = { email: true, profileLevel: true, isActive: true } as const;

export async function list(req: AuthenticatedRequest, res: Response) {
  let memberIdFilter: string[] | undefined;

  if (req.profileLevel === "COORDENADOR" && req.userId) {
    const me = await prisma.member.findUnique({ where: { userId: req.userId } });
    if (me) {
      const coordinatedGroups = await prisma.group.findMany({
        where: { coordinatorId: me.id },
        select: { id: true },
      });
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId: { in: coordinatedGroups.map((g) => g.id) } },
        select: { memberId: true },
      });
      memberIdFilter = Array.from(new Set([me.id, ...groupMembers.map((gm) => gm.memberId)]));
    } else {
      memberIdFilter = [];
    }
  }

  const members = await prisma.member.findMany({
    where: memberIdFilter ? { id: { in: memberIdFilter } } : undefined,
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      phone: true,
      city: true,
      state: true,
      user: { select: userSelect },
    },
    orderBy: { fullName: "asc" },
  });
  res.json(members);
}

export async function getById(req: AuthenticatedRequest, res: Response) {
  const member = await prisma.member.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: userSelect },
      socials: true,
      familyMembers: true,
      emergencyContacts: true,
    },
  });

  if (!member) {
    return res.status(404).json({ message: "Membro não encontrado" });
  }

  res.json(member);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const member = await prisma.member.findUnique({ where: { id: req.params.id } });
  if (!member) {
    return res.status(404).json({ message: "Membro não encontrado" });
  }

  const isSelf = member.userId === req.userId;
  const isManager = MANAGER_PROFILES.includes(req.profileLevel ?? "");
  if (!isSelf && !isManager) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const updated = await prisma.member.update({ where: { id: member.id }, data: parsed.data });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } });
  if (!member) {
    return res.status(404).json({ message: "Membro não encontrado" });
  }

  await prisma.user.delete({ where: { id: member.userId } });
  res.status(204).send();
}
