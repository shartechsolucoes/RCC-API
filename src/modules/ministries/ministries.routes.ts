import { Router } from "express";

import {
  create,
  getBySlug,
  list,
  listRequests,
  myRequests,
  remove,
  requestToJoin,
  update,
  updateRequestStatus,
} from "./ministries.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const canManage = requireProfile("ROOT", "COORDENACAO_GERAL");

router.get("/", asyncHandler(list));
router.get("/my-requests", requireAuth, asyncHandler(myRequests));
router.get("/:slug", asyncHandler(getBySlug));
router.post("/", requireAuth, canManage, asyncHandler(create));
router.patch("/:id", requireAuth, canManage, asyncHandler(update));
router.delete("/:id", requireAuth, canManage, asyncHandler(remove));

router.post("/:id/requests", requireAuth, asyncHandler(requestToJoin));
router.get("/:id/requests", requireAuth, canManage, asyncHandler(listRequests));
router.patch("/:id/requests/:requestId", requireAuth, canManage, asyncHandler(updateRequestStatus));

export default router;
