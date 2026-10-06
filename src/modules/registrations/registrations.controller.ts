import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import type { Prisma } from "../../../generated/client";
import type { Request, Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { pixCopiaECola, pixQrCodeDataUrl } from "../../lib/pix";
import { prisma } from "../../lib/prisma";
import { stringList } from "../events/registration-settings.controller";
import { missingRequiredFields, resolveFormConfig, stripHiddenFields } from "./registration-form";

const STAFF_PROFILES = ["COORDENADOR", "COORDENACAO_GERAL", "ROOT"];

const createSchema = z.object({
  eventId: z.string().optional(),
  fullName: z.string().min(3),
  cpf: z.string().min(11).optional(),
  email: z.string().email(),
  phone: z.string().min(8).optional(),
  photoUrl: z.string().min(1).max(7_000_000).optional(),
  
  nomeCracha: z.string().optional(),
  sexo: z.string().optional(),
  dataNascimento: z.string().optional(),
  instagram: z.string().optional(),
  escolaridade: z.string().optional(),
  profissao: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  cep: z.string().optional(),
  estado: z.string().optional(),
  complemento: z.string().optional(),
  sacramentoBatismo: z.boolean().optional(),
  sacramentoEucaristia: z.boolean().optional(),
  sacramentoCrisma: z.boolean().optional(),
  sacramentoNenhum: z.boolean().optional(),
  participouMovimento: z.boolean().optional(),
  quaisMovimentos: z.string().optional(),
  incentivadoPor: z.string().optional(),
  motivoEncontro: z.string().optional(),
  usaMedicamentoContinuo: z.boolean().optional(),
  qualMedicamento: z.string().optional(),
  temAlergiaMedicamento: z.boolean().optional(),
  quaisAlergiaMedicamento: z.string().optional(),
  temAlergiaAlimentar: z.boolean().optional(),
  quaisAlergiaAlimentar: z.string().optional(),
  precisaCuidadoEspecial: z.boolean().optional(),
  qualCuidadoEspecial: z.string().optional(),
  isCasado: z.boolean().optional(),
  dataCasamento: z.string().optional(),
  nomeConjuge: z.string().optional(),
  temFilhos: z.boolean().optional(),
  idadesFilhos: z.string().optional(),
  temParenteNoEncontro: z.boolean().optional(),
  nomeParentesco: z.string().optional(),
  emergencia1Nome: z.string().optional(),
  emergencia1Telefone: z.string().optional(),
  emergencia2Nome: z.string().optional(),
  emergencia2Telefone: z.string().optional(),
  emergencia3Nome: z.string().optional(),
  emergencia3Telefone: z.string().optional(),
  encontrosResgataMe: z.boolean().optional(),
  encontrosResgatao: z.boolean().optional(),
  encontrosResgataMeConjugal: z.boolean().optional(),
  encontrosOutros: z.boolean().optional(),
  encontrosOutrosQual: z.string().optional(),
  encontrosNenhum: z.boolean().optional(),

  items: z
    .array(
      z.object({
        itemId: z.string(),
        option: z.string().trim().max(20).optional(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .max(60)
    .optional(),
});

const statusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLIST"]),
  note: z.string().optional(),
});

type EventForPayment = {
  name: string;
  pixKey: string | null;
  pixReceiverName: string | null;
  pixCity: string | null;
};

type RegistrationForPayment = {
  id: string;
  fullName: string;
  totalAmount: unknown;
  paymentStatus: string;
  paymentToken: string | null;
  paymentProofUrl: string | null;
  paidAt: Date | null;
  items: { name: string; option: string | null; unitPrice: unknown; quantity: number }[];
};

// Dados que o inscrito vê para pagar: total, itens, Pix copia-e-cola e QR Code.
async function buildPayment(registration: RegistrationForPayment, event: EventForPayment | null) {
  const total = Number(registration.totalAmount);
  let pix: { copiaECola: string; qrCode: string; key: string; receiverName: string | null } | null = null;

  if (total > 0 && event?.pixKey) {
    const copiaECola = pixCopiaECola({
      key: event.pixKey,
      receiverName: event.pixReceiverName || event.name,
      city: event.pixCity || "BRASIL",
      amount: total,
      txid: registration.id,
    });
    pix = { copiaECola, qrCode: await pixQrCodeDataUrl(copiaECola), key: event.pixKey, receiverName: event.pixReceiverName };
  }

  return {
    registrationId: registration.id,
    token: registration.paymentToken,
    eventName: event?.name ?? null,
    fullName: registration.fullName,
    total,
    items: registration.items.map((i) => ({
      name: i.name,
      option: i.option,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
    })),
    status: registration.paymentStatus,
    proofUrl: registration.paymentProofUrl,
    paidAt: registration.paidAt,
    pix,
  };
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("Validation error:", JSON.stringify(parsed.error.issues, null, 2), "Body:", req.body);
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const { eventId, items: chosenItems = [], ...rest } = parsed.data;

  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId }, include: { items: { where: { isActive: true } } } })
    : null;
  if (eventId && !event) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  // Campos conforme a configuração do evento. A equipe (cadastro manual pelo Dash)
  // não é barrada pelos obrigatórios; o formulário público é.
  const config = resolveFormConfig(event?.formConfig);
  const isStaff = STAFF_PROFILES.includes(req.profileLevel ?? "");
  if (event && !isStaff) {
    const missing = missingRequiredFields(config, rest);
    if (missing.length > 0) {
      return res.status(400).json({ message: `Preencha os campos obrigatórios: ${missing.join(", ")}` });
    }
  }
  const { fullName, cpf, email, phone, photoUrl, ...fields } = (event ? stripHiddenFields(config, rest) : rest) as typeof rest;

  // Itens extras: só os ativos do próprio evento. Item com opções (tamanhos) exige uma
  // opção válida por linha; o limite por pessoa vale para a soma de todas as opções.
  const lines: { eventItemId: string; name: string; option: string | null; unitPrice: number; quantity: number }[] = [];
  const perItem = new Map<string, number>();
  for (const choice of chosenItems) {
    const item = event?.items.find((i) => i.id === choice.itemId);
    if (!item) {
      return res.status(400).json({ message: "Item indisponível para este evento" });
    }
    const options = stringList(item.options);
    const option = options.find((o) => o.toLowerCase() === choice.option?.toLowerCase()) ?? null;
    if (options.length > 0 && !option) {
      return res.status(400).json({ message: `Escolha uma opção válida para "${item.name}" (${options.join(", ")})` });
    }
    const sum = (perItem.get(item.id) ?? 0) + choice.quantity;
    perItem.set(item.id, sum);
    if (item.maxPerPerson != null && sum > item.maxPerPerson) {
      return res.status(400).json({ message: `Quantidade máxima de "${item.name}": ${item.maxPerPerson}` });
    }
    const line = { eventItemId: item.id, name: item.name, option, unitPrice: Number(item.price), quantity: choice.quantity };
    const existing = lines.find((l) => l.eventItemId === item.id && l.option === option);
    if (existing) existing.quantity += choice.quantity;
    else lines.push(line);
  }

  const itemsTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.round((Number(event?.registrationFee ?? 0) + itemsTotal) * 100) / 100;

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
      ...fields,
      totalAmount: total,
      paymentStatus: total > 0 ? "PENDING" : "NOT_REQUIRED",
      paymentToken: total > 0 ? crypto.randomBytes(18).toString("base64url") : null,
      items: { create: lines },
      statusHistory: { create: { status: "PENDING" } },
    },
    include: { items: true },
  });

  const payment = total > 0 ? await buildPayment(registration, event) : null;
  const { paymentToken: _token, ...publicData } = registration;
  return res.status(201).json({ ...publicData, totalAmount: total, payment });
}

export async function list(req: Request, res: Response) {
  const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;

  const registrations = await prisma.registration.findMany({
    where: eventId ? { eventId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { items: { select: { name: true, option: true, unitPrice: true, quantity: true } } },
  });
  res.json(
    registrations.map(({ paymentToken: _token, ...r }) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      items: r.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    })),
  );
}

// Página de pagamento do inscrito (pública, protegida pelo token devolvido na inscrição).
async function findByToken(id: string, token: unknown) {
  if (typeof token !== "string" || token.length < 10) return null;
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { items: true, event: { select: { name: true, pixKey: true, pixReceiverName: true, pixCity: true } } },
  });
  if (!registration || registration.paymentToken !== token) return null;
  return registration;
}

export async function getPayment(req: Request, res: Response) {
  const registration = await findByToken(req.params.id, req.query.token);
  if (!registration) {
    return res.status(404).json({ message: "Inscrição não encontrada" });
  }
  res.json(await buildPayment(registration, registration.event));
}

const proofSchema = z.object({ token: z.string(), proofUrl: z.string().url().max(500) });

export async function sendPaymentProof(req: Request, res: Response) {
  const parsed = proofSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const registration = await findByToken(req.params.id, parsed.data.token);
  if (!registration) {
    return res.status(404).json({ message: "Inscrição não encontrada" });
  }
  if (registration.paymentStatus === "PAID") {
    return res.status(409).json({ message: "Este pagamento já foi confirmado" });
  }

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { paymentProofUrl: parsed.data.proofUrl, paymentStatus: "PROOF_SENT" },
    include: { items: true },
  });
  res.json(await buildPayment(updated, registration.event));
}

const paidSchema = z.object({ paid: z.boolean() });

// Coordenação confirma (ou desfaz) o pagamento. Confirmar lança a entrada no Financeiro.
export async function setPayment(req: Request, res: Response) {
  const parsed = paidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const registration = await prisma.registration.findUnique({
    where: { id: req.params.id },
    include: { event: { select: { name: true } } },
  });
  if (!registration) {
    return res.status(404).json({ message: "Inscrição não encontrada" });
  }
  if (Number(registration.totalAmount) <= 0) {
    return res.status(409).json({ message: "Esta inscrição não tem valor a pagar" });
  }

  if (parsed.data.paid) {
    if (registration.paymentStatus === "PAID") return res.json({ paymentStatus: "PAID" });
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.financialTransaction.create({
        data: {
          type: "INCOME",
          category: "Inscrições",
          amount: registration.totalAmount,
          description: `Inscrição — ${registration.fullName}${registration.event ? ` (${registration.event.name})` : ""}`,
          eventId: registration.eventId,
          receiptUrl: registration.paymentProofUrl,
          occurredAt: new Date(),
        },
      });
      await tx.registration.update({
        where: { id: registration.id },
        data: { paymentStatus: "PAID", paidAt: new Date(), financialTransactionId: transaction.id },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.registration.update({
        where: { id: registration.id },
        data: {
          paymentStatus: registration.paymentProofUrl ? "PROOF_SENT" : "PENDING",
          paidAt: null,
          financialTransactionId: null,
        },
      });
      if (registration.financialTransactionId) {
        await tx.financialTransaction.deleteMany({ where: { id: registration.financialTransactionId } });
      }
    });
  }

  const updated = await prisma.registration.findUnique({ where: { id: registration.id } });
  res.json({ paymentStatus: updated?.paymentStatus, paidAt: updated?.paidAt });
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

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const birthDateRaw = registration.dataNascimento as string | undefined;
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
          city: registration.cidade ?? undefined,
          state: registration.estado ?? undefined,
          emergencyContacts: registration.emergencia1Telefone
            ? {
                create: {
                  name: registration.emergencia1Nome ?? "Contato de emergência",
                  phone: registration.emergencia1Telefone,
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
