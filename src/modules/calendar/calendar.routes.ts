import { Router } from "express";

import { create, list, remove, update } from "./calendar.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

// Marcações e visualização: ID 0-1 (Root, Coordenação Geral) — conforme o plano.
const canManage = requireProfile("ROOT", "COORDENACAO_GERAL");

router.get("/", requireAuth, canManage, asyncHandler(list));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.patch("/:id", requireAuth, canManage, asyncHandler(update));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));

export default router;
