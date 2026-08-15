import type { Request, Response } from "express";

import { prisma } from "../../lib/prisma";

export async function summary(_req: Request, res: Response) {
  const [
    membersTotal,
    eventsTotal,
    missionsTotal,
    ministriesTotal,
    pending,
    approved,
    rejected,
    waitlist,
    income,
    expense,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.event.count(),
    prisma.mission.count(),
    prisma.ministry.count(),
    prisma.registration.count({ where: { status: "PENDING" } }),
    prisma.registration.count({ where: { status: "APPROVED" } }),
    prisma.registration.count({ where: { status: "REJECTED" } }),
    prisma.registration.count({ where: { status: "WAITLIST" } }),
    prisma.financialTransaction.aggregate({ where: { type: "INCOME" }, _sum: { amount: true } }),
    prisma.financialTransaction.aggregate({ where: { type: "EXPENSE" }, _sum: { amount: true } }),
  ]);

  const incomeTotal = Number(income._sum.amount ?? 0);
  const expenseTotal = Number(expense._sum.amount ?? 0);

  res.json({
    membersTotal,
    eventsTotal,
    missionsTotal,
    ministriesTotal,
    registrations: { pending, approved, rejected, waitlist },
    financial: { income: incomeTotal, expense: expenseTotal, balance: incomeTotal - expenseTotal },
  });
}
