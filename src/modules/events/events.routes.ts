import { Router } from "express";

import {
  cancelRequest,
  listTeams,
  removeMember,
  requestToJoin,
  setMemberActive,
  updateRequestStatus,
  updateTeam,
} from "./event-teams.controller";
import { addSponsor, create, getById, list, remove, removeSponsor, update } from "./events.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { optionalAuth, requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT");

router.get("/", optionalAuth, asyncHandler(list));
router.get("/:id", optionalAuth, asyncHandler(getById));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.patch("/:id", requireAuth, canManage, asyncHandler(update));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));
router.post("/:id/sponsors", requireAuth, canManage, asyncHandler(addSponsor));
router.delete("/:id/sponsors/:sponsorId", requireAuth, canManage, asyncHandler(removeSponsor));

router.get("/:id/teams", optionalAuth, asyncHandler(listTeams));
router.patch("/:id/teams/:teamId", requireAuth, asyncHandler(updateTeam));
router.post("/:id/teams/:teamId/requests", requireAuth, asyncHandler(requestToJoin));
router.delete("/:id/teams/:teamId/requests/me", requireAuth, asyncHandler(cancelRequest));
router.patch("/:id/teams/:teamId/requests/:requestId", requireAuth, asyncHandler(updateRequestStatus));
router.patch("/:id/teams/:teamId/members/:memberId", requireAuth, asyncHandler(setMemberActive));
router.delete("/:id/teams/:teamId/members/:memberId", requireAuth, asyncHandler(removeMember));

export default router;
