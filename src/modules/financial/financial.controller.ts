import type { Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

const createSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(2),
  amount: z.number().positive(),
  description: z.string().optional(),
  eventId: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  occurredAt: z.string().datetime(),
});

const updateSchema = createSchema.partial();

export async function list(_req: Request, res: Response) {
  const transactions = await prisma.financialTransaction.findMany({
    orderBy: { occurredAt: "desc" },
  });
  res.json(transactions);
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const transaction = await prisma.financialTransaction.create({ data: parsed.data });
  res.status(201).json(transaction);
}

export async function update(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const transaction = await prisma.financialTransaction.findUnique({ where: { id: req.params.id } });
  if (!transaction) {
    return res.status(404).json({ message: "Lançamento não encontrado" });
  }

  const updated = await prisma.financialTransaction.update({
    where: { id: transaction.id },
    data: parsed.data,
  });
  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const transaction = await prisma.financialTransaction.findUnique({ where: { id: req.params.id } });
  if (!transaction) {
    return res.status(404).json({ message: "Lançamento não encontrado" });
  }
  await prisma.financialTransaction.delete({ where: { id: transaction.id } });
  res.status(204).send();
}
