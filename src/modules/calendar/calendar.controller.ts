import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
});

const updateSchema = createSchema.partial();

export async function list(_req: AuthenticatedRequest, res: Response) {
  const entries = await prisma.calendarEvent.findMany({ orderBy: { startAt: "asc" } });
  res.json(entries);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const entry = await prisma.calendarEvent.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      startAt: new Date(parsed.data.startAt),
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : undefined,
    },
  });
  res.status(201).json(entry);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const entry = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
  if (!entry) {
    return res.status(404).json({ message: "Marcação não encontrada" });
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: entry.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : undefined,
    },
  });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const entry = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
  if (!entry) {
    return res.status(404).json({ message: "Marcação não encontrada" });
  }

  await prisma.calendarEvent.delete({ where: { id: entry.id } });
  res.status(204).send();
}
