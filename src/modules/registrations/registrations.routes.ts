import { Router } from "express";

import { checkIn, create, list, promote, updateStatus } from "./registrations.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

router.post("/", asyncHandler(create));
router.get(
  "/",
  requireAuth,
  requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT"),
  asyncHandler(list),
);
router.patch(
  "/:id/status",
  requireAuth,
  requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT"),
  asyncHandler(updateStatus),
);
router.patch(
  "/:id/checkin",
  requireAuth,
  requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT"),
  asyncHandler(checkIn),
);
router.post(
  "/:id/promote",
  requireAuth,
  requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT"),
  asyncHandler(promote),
);

export default router;
