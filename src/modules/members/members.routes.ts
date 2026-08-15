import { Router } from "express";

import { getById, list, remove, update } from "./members.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT");

router.get("/", requireAuth, asyncHandler(list));
router.get("/:id", requireAuth, asyncHandler(getById));
router.patch("/:id", requireAuth, asyncHandler(update));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));

export default router;
