import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  content: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

const authorInclude = {
  author: {
    select: { email: true, member: { select: { fullName: true, photoUrl: true } } },
  },
} as const;

export async function list(_req: AuthenticatedRequest, res: Response) {
  const posts = await prisma.post.findMany({
    include: authorInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(posts);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const post = await prisma.post.create({
    data: { ...parsed.data, authorId: req.userId as string },
    include: authorInclude,
  });
  res.status(201).json(post);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) {
    return res.status(404).json({ message: "Postagem não encontrada" });
  }

  const isAuthor = post.authorId === req.userId;
  const isManager = ["ROOT", "COORDENACAO_GERAL", "COORDENADOR"].includes(req.profileLevel ?? "");
  if (!isAuthor && !isManager) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  await prisma.post.delete({ where: { id: post.id } });
  res.status(204).send();
}
