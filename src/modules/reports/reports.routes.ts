import { Router } from "express";

import { summary } from "./reports.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  requireProfile("COORDENACAO_GERAL", "ROOT"),
  asyncHandler(summary),
);

export default router;
