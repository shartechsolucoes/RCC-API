import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  location: z.string().optional(),
  groupId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const updateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  location: z.string().optional(),
  groupId: z.string().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function list(req: AuthenticatedRequest, res: Response) {
  let groupIdFilter: string[] | undefined;

  if (req.profileLevel === "COORDENADOR" && req.userId) {
    const member = await prisma.member.findUnique({ where: { userId: req.userId } });
    if (member) {
      const coordinatedGroups = await prisma.group.findMany({
        where: { coordinatorId: member.id },
        select: { id: true },
      });
      groupIdFilter = coordinatedGroups.map((g) => g.id);
    } else {
      groupIdFilter = [];
    }
  }

  const isRoot = req.profileLevel === "ROOT";

  const events = await prisma.event.findMany({
    where: {
      groupId: groupIdFilter ? { in: groupIdFilter } : undefined,
      isActive: isRoot ? undefined : true,
    },
    include: { group: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
  });
  res.json(events);
}

export async function getById(req: AuthenticatedRequest, res: Response) {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      teams: true,
      group: { select: { id: true, name: true } },
      sponsors: { include: { company: true } },
    },
  });

  if (!event || (!event.isActive && req.profileLevel !== "ROOT")) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  res.json(event);
}

const addSponsorSchema = z.object({
  companyId: z.string(),
});

export async function addSponsor(req: AuthenticatedRequest, res: Response) {
  const parsed = addSponsorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  const company = await prisma.company.findUnique({ where: { id: parsed.data.companyId } });
  if (!company) {
    return res.status(404).json({ message: "Empresa não encontrada" });
  }

  const existing = await prisma.eventSponsor.findUnique({
    where: { eventId_companyId: { eventId: event.id, companyId: company.id } },
  });
  if (existing) {
    return res.status(409).json({ message: "Empresa já vinculada a este evento" });
  }

  const sponsor = await prisma.eventSponsor.create({
    data: { eventId: event.id, companyId: company.id },
    include: { company: true },
  });

  res.status(201).json(sponsor);
}

export async function removeSponsor(req: AuthenticatedRequest, res: Response) {
  const sponsor = await prisma.eventSponsor.findUnique({ where: { id: req.params.sponsorId } });
  if (!sponsor || sponsor.eventId !== req.params.id) {
    return res.status(404).json({ message: "Vínculo não encontrado" });
  }

  await prisma.eventSponsor.delete({ where: { id: sponsor.id } });
  res.status(204).send();
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const event = await prisma.event.create({ data: parsed.data });
  res.status(201).json(event);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  const updated = await prisma.event.update({ where: { id: event.id }, data: parsed.data });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  await prisma.event.delete({ where: { id: event.id } });
  res.status(204).send();
}
