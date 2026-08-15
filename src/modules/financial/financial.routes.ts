import { Router } from "express";

import { create, list, remove, update } from "./financial.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENACAO_GERAL", "ROOT");

router.get("/", requireAuth, canManage, asyncHandler(list));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.patch("/:id", requireAuth, canManage, asyncHandler(update));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));

export default router;
