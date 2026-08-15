import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import type { Prisma } from "@fraternidade/database";
import type { Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  eventId: z.string().optional(),
  fullName: z.string().min(3),
  cpf: z.string().min(11).optional(),
  email: z.string().email(),
  phone: z.string().min(8).optional(),
  photoUrl: z.string().min(1).max(7_000_000).optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
});

const statusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLIST"]),
  note: z.string().optional(),
});

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const { eventId, fullName, cpf, email, phone, photoUrl, formData } = parsed.data;

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
  }

  const existingPending = await prisma.registration.findFirst({
    where: { email, status: "PENDING", eventId: eventId ?? null },
  });
  if (existingPending) {
    return res.status(409).json({ message: "Já existe uma inscrição pendente para este e-mail" });
  }

  const registration = await prisma.registration.create({
    data: {
      eventId,
      fullName,
      cpf,
      email,
      phone,
      photoUrl,
      formData: formData as Prisma.InputJsonValue | undefined,
      statusHistory: { create: { status: "PENDING" } },
    },
  });

  return res.status(201).json(registration);
}

export async function list(req: Request, res: Response) {
  const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;

  const registrations = await prisma.registration.findMany({
    where: eventId ? { eventId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(registrations);
}

export async function updateStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
  if (!registration) {
    return res.status(404).json({ message: "Inscrição não encontrada" });
  }

  const { status, note } = parsed.data;

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: {
      status,
      statusHistory: { create: { status, note } },
    },
  });

  return res.json(updated);
}

const checkInSchema = z.object({
  checkedIn: z.boolean(),
});

export async function checkIn(req: Request, res: Response) {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
  if (!registration) {
    return res.status(404).json({ message: "Inscrição não encontrada" });
  }

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { checkedInAt: parsed.data.checkedIn ? new Date() : null },
  });

  return res.json(updated);
}

export async function promote(req: Request, res: Response) {
  const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
  if (!registration) {
    return res.status(404).json({ message: "Inscrição não encontrada" });
  }

  if (registration.memberId) {
    return res.status(409).json({ message: "Inscrição já vinculada a um usuário" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: registration.email } });
  if (existingUser) {
    return res.status(409).json({ message: "Já existe um usuário cadastrado com este e-mail" });
  }

  const formData = (registration.formData ?? {}) as Record<string, unknown>;
  const endereco = (formData.endereco ?? {}) as Record<string, unknown>;
  const responsavelEmergencia = formData.responsavelEmergencia as string | undefined;
  const contatoEmergencia = formData.contatoEmergencia as string | undefined;

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const birthDateRaw = formData.dataNascimento as string | undefined;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : undefined;

  const user = await prisma.user.create({
    data: {
      email: registration.email,
      passwordHash,
      profileLevel: "MEMBRO",
      member: {
        create: {
          fullName: registration.fullName,
          photoUrl: registration.photoUrl,
          phone: registration.phone,
          birthDate,
          city: endereco.cidade as string | undefined,
          state: endereco.estado as string | undefined,
          emergencyContacts: contatoEmergencia
            ? {
                create: {
                  name: responsavelEmergencia ?? "Contato de emergência",
                  phone: contatoEmergencia,
                },
              }
            : undefined,
        },
      },
    },
    include: { member: true },
  });

  await prisma.registration.update({
    where: { id: registration.id },
    data: { memberId: user.member!.id },
  });

  if (registration.eventId) {
    await prisma.eventMember.upsert({
      where: { eventId_memberId: { eventId: registration.eventId, memberId: user.member!.id } },
      create: { eventId: registration.eventId, memberId: user.member!.id, status: "CONFIRMED" },
      update: { status: "CONFIRMED" },
    });
  }

  return res.status(201).json({
    userId: user.id,
    email: user.email,
    memberId: user.member!.id,
    tempPassword,
  });
}
