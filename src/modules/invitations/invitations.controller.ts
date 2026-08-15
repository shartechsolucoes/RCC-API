import crypto from "node:crypto";

import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  email: z.string().email(),
  profileLevel: z.enum(["ROOT", "COORDENACAO_GERAL", "COORDENADOR", "MEMBRO"]).default("MEMBRO"),
});

export async function list(_req: AuthenticatedRequest, res: Response) {
  const invitations = await prisma.invitation.findMany({ orderBy: { createdAt: "desc" } });
  res.json(invitations);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email: parsed.data.email,
      profileLevel: parsed.data.profileLevel,
      invitedById: req.userId as string,
      token: crypto.randomBytes(24).toString("hex"),
      expiresAt,
    },
  });

  res.status(201).json(invitation);
}

export async function revoke(req: AuthenticatedRequest, res: Response) {
  const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
  if (!invitation) {
    return res.status(404).json({ message: "Convite não encontrado" });
  }

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED" },
  });

  res.json(updated);
}
