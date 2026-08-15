import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().optional(),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  categoryId: z.string().min(1),
  isInternal: z.boolean().optional(),
  content: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
});

const updateSchema = createSchema.partial();

const statusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

const include = {
  category: true,
  author: {
    select: { email: true, member: { select: { fullName: true } } },
  },
} as const;

export async function list(_req: AuthenticatedRequest, res: Response) {
  const news = await prisma.news.findMany({
    include,
    orderBy: { createdAt: "desc" },
  });
  res.json(news);
}

export async function listPublic(req: AuthenticatedRequest, res: Response) {
  const news = await prisma.news.findMany({
    where: {
      status: "PUBLISHED",
      isInternal: false,
      publishedAt: { lte: new Date() },
    },
    include,
    orderBy: { publishedAt: "desc" },
  });
  res.json(news);
}

export async function getBySlug(req: AuthenticatedRequest, res: Response) {
  const news = await prisma.news.findUnique({
    where: { slug: req.params.slug },
    include,
  });
  if (!news) {
    return res.status(404).json({ message: "Notícia não encontrada" });
  }
  res.json(news);
}

export async function getBySlugPublic(req: AuthenticatedRequest, res: Response) {
  const news = await prisma.news.findUnique({
    where: { slug: req.params.slug },
    include,
  });
  if (!news || news.isInternal || news.status !== "PUBLISHED") {
    return res.status(404).json({ message: "Notícia não encontrada" });
  }

  const updated = await prisma.news.update({
    where: { id: news.id },
    data: { viewCount: { increment: 1 } },
    include,
  });

  res.json(updated);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const news = await prisma.news.create({
    data: { ...parsed.data, authorId: req.userId as string },
    include,
  });
  res.status(201).json(news);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const news = await prisma.news.findUnique({ where: { id: req.params.id } });
  if (!news) {
    return res.status(404).json({ message: "Notícia não encontrada" });
  }

  const updated = await prisma.news.update({ where: { id: news.id }, data: parsed.data, include });
  res.json(updated);
}

export async function updateStatus(req: AuthenticatedRequest, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const news = await prisma.news.findUnique({ where: { id: req.params.id } });
  if (!news) {
    return res.status(404).json({ message: "Notícia não encontrada" });
  }

  const data: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; publishedAt?: Date } = {
    status: parsed.data.status,
  };
  if (parsed.data.status === "PUBLISHED" && !news.publishedAt) {
    data.publishedAt = new Date();
  }

  const updated = await prisma.news.update({ where: { id: news.id }, data, include });
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const news = await prisma.news.findUnique({ where: { id: req.params.id } });
  if (!news) {
    return res.status(404).json({ message: "Notícia não encontrada" });
  }
  await prisma.news.delete({ where: { id: news.id } });
  res.status(204).send();
}
