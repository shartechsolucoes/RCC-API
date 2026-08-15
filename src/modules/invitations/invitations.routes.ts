import { Router } from "express";

import { create, list, revoke } from "./invitations.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENACAO_GERAL", "ROOT");

router.get("/", requireAuth, canManage, asyncHandler(list));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.patch("/:id/revoke", requireAuth, canManage, asyncHandler(revoke));

export default router;
