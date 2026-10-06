import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";
import { FORM_FIELDS, resolveFormConfig, sanitizeFormConfig } from "../registrations/registration-form";

// Configuração da inscrição de um evento (valor, Pix, itens extras e campos do
// formulário). Só coordenação geral / root — ver events.routes.ts.

// images/options ficam em colunas JSON; garante sempre um array de strings na saída.
export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

function toItemDto(item: {
  id: string;
  name: string;
  description: string | null;
  images: unknown;
  options: unknown;
  price: unknown;
  maxPerPerson: number | null;
  isActive: boolean;
  order: number;
}) {
  return { ...item, images: stringList(item.images), options: stringList(item.options), price: Number(item.price) };
}

async function buildSettings(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!event) return null;

  return {
    registrationFee: Number(event.registrationFee),
    pixKey: event.pixKey,
    pixReceiverName: event.pixReceiverName,
    pixCity: event.pixCity,
    formConfig: resolveFormConfig(event.formConfig),
    fields: FORM_FIELDS.map(({ key, label, section, default: defaultMode }) => ({ key, label, section, default: defaultMode })),
    items: event.items.map(toItemDto),
  };
}

export async function getRegistrationSettings(req: AuthenticatedRequest, res: Response) {
  const settings = await buildSettings(req.params.id);
  if (!settings) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }
  res.json(settings);
}

const money = z.number().min(0).max(100_000);

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2),
  description: z.string().trim().max(190).nullable().optional(),
  images: z.array(z.string().url().max(500)).max(10).default([]),
  // Tamanhos/variações; sem repetição (comparando sem diferença de maiúsculas).
  options: z
    .array(z.string().trim().min(1).max(20))
    .max(20)
    .default([])
    .refine((list) => new Set(list.map((o) => o.toLowerCase())).size === list.length, "Há opções repetidas no item"),
  price: money,
  maxPerPerson: z.number().int().min(1).max(100).nullable().optional(),
  isActive: z.boolean().default(true),
});

const settingsSchema = z
  .object({
    registrationFee: money,
    pixKey: z.string().trim().max(77).nullable().optional(),
    pixReceiverName: z.string().trim().max(60).nullable().optional(),
    pixCity: z.string().trim().max(40).nullable().optional(),
    formConfig: z.record(z.string(), z.string()),
    items: z.array(itemSchema).max(30),
  })
  .refine((s) => (s.registrationFee === 0 && s.items.every((i) => i.price === 0)) || Boolean(s.pixKey), {
    message: "Informe a chave Pix para receber os pagamentos",
    path: ["pixKey"],
  });

export async function updateRegistrationSettings(req: AuthenticatedRequest, res: Response) {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return res.status(400).json({ message, issues: parsed.error.issues });
  }

  const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!event) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  const data = parsed.data;
  const keptIds = new Set(data.items.map((i) => i.id).filter(Boolean));
  const removed = event.items.filter((i) => !keptIds.has(i.id));

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: event.id },
      data: {
        registrationFee: data.registrationFee,
        pixKey: data.pixKey || null,
        pixReceiverName: data.pixReceiverName || null,
        pixCity: data.pixCity || null,
        formConfig: sanitizeFormConfig(data.formConfig),
      },
    });

    // Item tirado da lista: se alguém já comprou, só desativa (o histórico da inscrição aponta para ele).
    for (const item of removed) {
      const used = await tx.registrationItem.count({ where: { eventItemId: item.id } });
      if (used > 0) await tx.eventItem.update({ where: { id: item.id }, data: { isActive: false } });
      else await tx.eventItem.delete({ where: { id: item.id } });
    }

    for (const [order, item] of data.items.entries()) {
      const values = {
        name: item.name,
        description: item.description || null,
        images: item.images,
        options: item.options,
        price: item.price,
        maxPerPerson: item.maxPerPerson ?? null,
        isActive: item.isActive,
        order,
      };
      const existing = item.id ? event.items.find((i) => i.id === item.id) : undefined;
      if (existing) await tx.eventItem.update({ where: { id: existing.id }, data: values });
      else await tx.eventItem.create({ data: { ...values, eventId: event.id } });
    }
  });

  res.json(await buildSettings(event.id));
}

// O que o formulário público precisa saber da inscrição (sem dados sensíveis além da chave Pix).
export async function publicRegistrationInfo(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      registrationFee: true,
      formConfig: true,
      items: {
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, description: true, images: true, options: true, price: true, maxPerPerson: true },
      },
    },
  });
  if (!event) return null;
  return {
    registrationFee: Number(event.registrationFee),
    form: resolveFormConfig(event.formConfig),
    items: event.items.map((i) => ({
      ...i,
      images: stringList(i.images),
      options: stringList(i.options),
      price: Number(i.price),
    })),
  };
}
