import { Router } from "express";

import { list, update } from "./users.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENACAO_GERAL", "ROOT");

router.get("/", requireAuth, canManage, asyncHandler(list));
router.patch("/:id", requireAuth, canManage, asyncHandler(update));

export default router;
