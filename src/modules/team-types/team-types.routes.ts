import { Router } from "express";

import { create, list, remove, update } from "./team-types.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { optionalAuth, requireAuth } from "../../common/middlewares/auth.middleware";

const router = Router();

router.get("/", optionalAuth, asyncHandler(list));
router.post("/", requireAuth, asyncHandler(create));
router.patch("/:id", requireAuth, asyncHandler(update));
router.delete("/:id", requireAuth, asyncHandler(remove));

export default router;
