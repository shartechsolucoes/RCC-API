import { Router } from "express";

import {
  checkIn,
  create,
  getPayment,
  list,
  promote,
  sendPaymentProof,
  setPayment,
  updateStatus,
} from "./registrations.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { optionalAuth, requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const staff = requireProfile("COORDENADOR", "COORDENACAO_GERAL", "ROOT");

// Público: formulário do site (optionalAuth só para reconhecer cadastro feito pela equipe).
router.post("/", optionalAuth, asyncHandler(create));
// Público, protegido pelo token de pagamento da inscrição.
router.get("/:id/payment", asyncHandler(getPayment));
router.post("/:id/payment-proof", asyncHandler(sendPaymentProof));

router.get("/", requireAuth, staff, asyncHandler(list));
router.patch("/:id/status", requireAuth, staff, asyncHandler(updateStatus));
router.patch("/:id/checkin", requireAuth, staff, asyncHandler(checkIn));
router.patch("/:id/payment", requireAuth, staff, asyncHandler(setPayment));
router.post("/:id/promote", requireAuth, staff, asyncHandler(promote));

export default router;
