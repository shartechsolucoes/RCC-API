import { Router } from "express";

import { login, me, register } from "./auth.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/middlewares/auth.middleware";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
