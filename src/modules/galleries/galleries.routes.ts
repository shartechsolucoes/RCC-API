import { Router } from "express";

import { addPhoto, create, list, remove, removePhoto } from "./galleries.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT");

router.get("/", asyncHandler(list));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));
router.post("/:id/photos", requireAuth, canManage, asyncHandler(addPhoto));
router.delete("/:id/photos/:photoId", requireAuth, canManage, asyncHandler(removePhoto));

export default router;
