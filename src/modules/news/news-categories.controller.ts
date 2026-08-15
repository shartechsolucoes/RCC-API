import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const upsertSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
});

export async function list(_req: AuthenticatedRequest, res: Response) {
  const categories = await prisma.newsCategory.findMany({ orderBy: { name: "asc" } });
  res.json(categories);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const exists = await prisma.newsCategory.findUnique({ where: { slug: parsed.data.slug } });
  if (exists) {
    return res.status(409).json({ message: "Já existe uma categoria com esse slug" });
  }

  const category = await prisma.newsCategory.create({ data: parsed.data });
  res.status(201).json(category);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const category = await prisma.newsCategory.findUnique({ where: { id: req.params.id } });
  if (!category) {
    return res.status(404).json({ message: "Categoria não encontrada" });
  }

  const updated = await prisma.newsCategory.update({ where: { id: category.id }, data: parsed.data });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const category = await prisma.newsCategory.findUnique({ where: { id: req.params.id } });
  if (!category) {
    return res.status(404).json({ message: "Categoria não encontrada" });
  }

  const inUse = await prisma.news.count({ where: { categoryId: category.id } });
  if (inUse > 0) {
    return res.status(409).json({ message: "Categoria em uso por notícias existentes" });
  }

  await prisma.newsCategory.delete({ where: { id: category.id } });
  res.status(204).send();
}
