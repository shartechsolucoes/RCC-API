import { Router } from "express";

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

export default router;
