import { Router } from "express";

import { create, getBySlug, getBySlugPublic, list, listPublic, remove, update, updateStatus } from "./news.controller";
import newsCategoriesRouter from "./news-categories.routes";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT");

router.use("/categories", newsCategoriesRouter);

router.get("/public", asyncHandler(listPublic));
router.get("/public/:slug", asyncHandler(getBySlugPublic));

router.get("/", requireAuth, asyncHandler(list));
router.get("/:slug", requireAuth, asyncHandler(getBySlug));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.patch("/:id", requireAuth, canManage, asyncHandler(update));
router.patch("/:id/status", requireAuth, canManage, asyncHandler(updateStatus));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));

export default router;
