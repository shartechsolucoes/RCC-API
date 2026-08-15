import type { Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  contactInfo: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressNeighborhood: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZipCode: z.string().optional(),
});

const updateSchema = createSchema.partial();

export async function list(_req: Request, res: Response) {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  res.json(companies);
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const company = await prisma.company.create({ data: parsed.data });
  res.status(201).json(company);
}

export async function update(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) {
    return res.status(404).json({ message: "Empresa não encontrada" });
  }

  const updated = await prisma.company.update({ where: { id: company.id }, data: parsed.data });
  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) {
    return res.status(404).json({ message: "Empresa não encontrada" });
  }
  await prisma.company.delete({ where: { id: company.id } });
  res.status(204).send();
}
