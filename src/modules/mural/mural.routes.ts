import { Router } from "express";

import { create, list, listPublic, remove } from "./mural.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

// Postagem/edição: ID 0-2 (Root, Coordenação Geral, Coordenador). Visualização: ID 0-3 (todos).
const canPost = requireProfile("ROOT", "COORDENACAO_GERAL", "COORDENADOR");

router.get("/public", asyncHandler(listPublic));
router.get("/", requireAuth, asyncHandler(list));
router.post("/", requireAuth, canPost, asyncHandler(create));
router.delete("/:id", requireAuth, asyncHandler(remove));

export default router;
