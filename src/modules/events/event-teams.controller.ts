import type { Response } from "express";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../common/middlewares/auth.middleware";
import { prisma } from "../../lib/prisma";

function isTopManager(req: AuthenticatedRequest) {
  return req.profileLevel === "ROOT" || req.profileLevel === "COORDENACAO_GERAL";
}

// Contexto de moderação do usuário logado para um evento: se é gestão do topo e
// se é o coordenador da fraternidade responsável (pode ser um usuário de perfil
// MEMBRO — o vínculo é por Group.coordinatorId, não pelo profileLevel).
async function resolveManageContext(
  req: AuthenticatedRequest,
  event: { groupId: string | null },
) {
  const isTop = isTopManager(req);
  let memberId: string | null = null;
  let isGroupCoordinator = false;

  if (req.userId) {
    const member = await prisma.member.findUnique({ where: { userId: req.userId } });
    memberId = member?.id ?? null;
    if (memberId && event.groupId) {
      const group = await prisma.group.findUnique({ where: { id: event.groupId } });
      isGroupCoordinator = group?.coordinatorId === memberId;
    }
  }

  return { isTop, memberId, isGroupCoordinator };
}

// Gerência do evento: coordenação geral / root, o coordenador da fraternidade
// responsável pelo evento, ou o coordenador da própria equipe.
async function canManageTeam(
  req: AuthenticatedRequest,
  team: { coordinatorId: string | null; event: { groupId: string | null } },
) {
  const ctx = await resolveManageContext(req, team.event);
  if (ctx.isTop || ctx.isGroupCoordinator) return true;
  return Boolean(ctx.memberId && team.coordinatorId === ctx.memberId);
}

// Instancia uma equipe para cada tipo aplicável ao evento (tipos globais + os da
// fraternidade responsável). Idempotente: só cria o que ainda não existe.
export async function syncEventTeams(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;

  const teamTypes = await prisma.teamType.findMany({
    where: {
      isActive: true,
      OR: [{ groupId: null }, ...(event.groupId ? [{ groupId: event.groupId }] : [])],
    },
  });

  const existing = await prisma.eventTeam.findMany({
    where: { eventId, teamTypeId: { not: null } },
    select: { teamTypeId: true },
  });
  const existingTypeIds = new Set(existing.map((t) => t.teamTypeId));

  const missing = teamTypes.filter((t) => !existingTypeIds.has(t.id));
  if (missing.length > 0) {
    await prisma.eventTeam.createMany({
      data: missing.map((t) => ({ eventId, teamTypeId: t.id, name: t.name })),
    });
  }
}

const teamInclude = {
  teamType: { select: { id: true, name: true, color: true } },
  coordinator: { select: { id: true, fullName: true, photoUrl: true } },
  members: {
    include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
  },
  requests: {
    include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
    orderBy: { requestedAt: "desc" as const },
  },
} as const;

export async function listTeams(req: AuthenticatedRequest, res: Response) {
  const eventId = req.params.id;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return res.status(404).json({ message: "Evento não encontrado" });
  }

  await syncEventTeams(eventId);

  const teams = await prisma.eventTeam.findMany({
    where: { eventId },
    include: teamInclude,
    orderBy: { name: "asc" },
  });

  const ctx = await resolveManageContext(req, event);
  const myMemberId = ctx.memberId;

  res.json(
    teams.map((team) => {
      const canManage = ctx.isTop || ctx.isGroupCoordinator || team.coordinatorId === myMemberId;
      const approved = team.members.map((m) => ({ ...m.member, isActive: m.isActive }));
      const requests = team.requests.map((r) => ({
        id: r.id,
        status: r.status,
        requestedAt: r.requestedAt,
        member: r.member,
      }));
      const myRequest = myMemberId
        ? requests.find((r) => r.member.id === myMemberId) ?? null
        : null;
      const isMember = myMemberId ? approved.some((m) => m.id === myMemberId) : false;
      const activeMembers = approved.filter((m) => m.isActive).length;
      const isFull = team.capacity != null && activeMembers >= team.capacity;

      return {
        id: team.id,
        name: team.name,
        teamType: team.teamType,
        coordinatorId: team.coordinatorId,
        coordinator: team.coordinator,
        capacity: team.capacity,
        activeMembers,
        isFull,
        members: approved,
        requests,
        myRequest,
        isMember,
        canManage,
      };
    }),
  );
}

async function loadTeam(eventId: string, teamId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { id: true, groupId: true } },
      members: { select: { memberId: true, isActive: true } },
    },
  });
  if (!team || team.eventId !== eventId) return null;
  return team;
}

// Membro pede para entrar numa equipe daquele evento.
export async function requestToJoin(req: AuthenticatedRequest, res: Response) {
  const team = await loadTeam(req.params.id, req.params.teamId);
  if (!team) {
    return res.status(404).json({ message: "Equipe não encontrada" });
  }

  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.status(404).json({ message: "Perfil de membro não encontrado" });
  }

  const alreadyMember = await prisma.eventTeamMember.findUnique({
    where: { eventTeamId_memberId: { eventTeamId: team.id, memberId: member.id } },
  });
  if (alreadyMember) {
    return res.status(409).json({ message: "Você já faz parte desta equipe" });
  }

  if (team.capacity != null && activeCount(team) >= team.capacity) {
    return res.status(409).json({ message: "As vagas desta equipe estão preenchidas" });
  }

  const existing = await prisma.eventTeamRequest.findUnique({
    where: { eventTeamId_memberId: { eventTeamId: team.id, memberId: member.id } },
  });
  if (existing && existing.status === "PENDING") {
    return res.status(409).json({ message: "Você já solicitou entrada nesta equipe" });
  }

  const request = existing
    ? await prisma.eventTeamRequest.update({
        where: { id: existing.id },
        data: { status: "PENDING", requestedAt: new Date() },
      })
    : await prisma.eventTeamRequest.create({
        data: { eventTeamId: team.id, memberId: member.id },
      });

  res.status(201).json(request);
}

// Membro cancela o próprio pedido pendente.
export async function cancelRequest(req: AuthenticatedRequest, res: Response) {
  const team = await loadTeam(req.params.id, req.params.teamId);
  if (!team) {
    return res.status(404).json({ message: "Equipe não encontrada" });
  }

  const member = await prisma.member.findUnique({ where: { userId: req.userId as string } });
  if (!member) {
    return res.status(404).json({ message: "Perfil de membro não encontrado" });
  }

  await prisma.eventTeamRequest.deleteMany({
    where: { eventTeamId: team.id, memberId: member.id, status: "PENDING" },
  });

  res.status(204).send();
}

const statusSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export async function updateRequestStatus(req: AuthenticatedRequest, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const team = await loadTeam(req.params.id, req.params.teamId);
  if (!team) {
    return res.status(404).json({ message: "Equipe não encontrada" });
  }

  if (!(await canManageTeam(req, team))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const request = await prisma.eventTeamRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request || request.eventTeamId !== team.id) {
    return res.status(404).json({ message: "Solicitação não encontrada" });
  }

  if (
    parsed.data.status === "APPROVED" &&
    team.capacity != null &&
    !team.members.some((m) => m.memberId === request.memberId && m.isActive) &&
    activeCount(team) >= team.capacity
  ) {
    return res.status(409).json({ message: "As vagas desta equipe estão preenchidas" });
  }

  const updated = await prisma.eventTeamRequest.update({
    where: { id: request.id },
    data: { status: parsed.data.status },
  });

  if (parsed.data.status === "APPROVED") {
    await prisma.eventTeamMember.upsert({
      where: { eventTeamId_memberId: { eventTeamId: team.id, memberId: request.memberId } },
      create: { eventTeamId: team.id, memberId: request.memberId },
      update: {},
    });
  } else {
    await prisma.eventTeamMember.deleteMany({
      where: { eventTeamId: team.id, memberId: request.memberId },
    });
  }

  res.json(updated);
}

export async function removeMember(req: AuthenticatedRequest, res: Response) {
  const team = await loadTeam(req.params.id, req.params.teamId);
  if (!team) {
    return res.status(404).json({ message: "Equipe não encontrada" });
  }

  if (!(await canManageTeam(req, team))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  await prisma.eventTeamMember.deleteMany({
    where: { eventTeamId: team.id, memberId: req.params.memberId },
  });
  await prisma.eventTeamRequest.deleteMany({
    where: { eventTeamId: team.id, memberId: req.params.memberId },
  });

  res.status(204).send();
}

const memberActiveSchema = z.object({ isActive: z.boolean() });

// Coordenador liga/desliga um integrante da equipe sem removê-lo (mantém histórico).
export async function setMemberActive(req: AuthenticatedRequest, res: Response) {
  const parsed = memberActiveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const team = await loadTeam(req.params.id, req.params.teamId);
  if (!team) {
    return res.status(404).json({ message: "Equipe não encontrada" });
  }

  if (!(await canManageTeam(req, team))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const membership = await prisma.eventTeamMember.findUnique({
    where: { eventTeamId_memberId: { eventTeamId: team.id, memberId: req.params.memberId } },
  });
  if (!membership) {
    return res.status(404).json({ message: "Integrante não encontrado nesta equipe" });
  }

  if (
    parsed.data.isActive &&
    !membership.isActive &&
    team.capacity != null &&
    activeCount(team) >= team.capacity
  ) {
    return res.status(409).json({ message: "As vagas desta equipe estão preenchidas" });
  }

  const updated = await prisma.eventTeamMember.update({
    where: { id: membership.id },
    data: { isActive: parsed.data.isActive },
  });

  res.json(updated);
}

const updateTeamSchema = z.object({
  name: z.string().min(2).optional(),
  coordinatorId: z.string().nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
});

// Nº de integrantes que ocupam vaga (ativos). Inativos não contam.
function activeCount(team: { members: { isActive: boolean }[] }) {
  return team.members.filter((m) => m.isActive).length;
}

export async function updateTeam(req: AuthenticatedRequest, res: Response) {
  const parsed = updateTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const team = await loadTeam(req.params.id, req.params.teamId);
  if (!team) {
    return res.status(404).json({ message: "Equipe não encontrada" });
  }

  if (!(await canManageTeam(req, team))) {
    return res.status(403).json({ message: "Acesso não permitido" });
  }

  const updated = await prisma.eventTeam.update({
    where: { id: team.id },
    data: parsed.data,
    include: teamInclude,
  });

  res.json(updated);
}
