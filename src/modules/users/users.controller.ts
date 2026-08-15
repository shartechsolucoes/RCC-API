import type { Request, Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const updateSchema = z.object({
  profileLevel: z.enum(["ROOT", "COORDENACAO_GERAL", "COORDENADOR", "MEMBRO"]).optional(),
  isActive: z.boolean().optional(),
});

export async function list(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      profileLevel: true,
      isActive: true,
      createdAt: true,
      member: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }

  if (parsed.data.profileLevel === "ROOT" && req.profileLevel !== "ROOT") {
    return res.status(403).json({ message: "Apenas ROOT pode conceder o perfil ROOT" });
  }

  if (user.id === req.userId && parsed.data.isActive === false) {
    return res.status(400).json({ message: "Você não pode desativar a própria conta" });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  res.json({ id: updated.id, email: updated.email, profileLevel: updated.profileLevel, isActive: updated.isActive });
}
