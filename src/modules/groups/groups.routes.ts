import { Router } from "express";

import {
  create,
  getById,
  list,
  listRequests,
  myGroups,
  myRequests,
  remove,
  removeMember,
  requestToJoin,
  update,
  updateRequestStatus,
} from "./groups.controller";
import { asyncHandler } from "../../common/asyncHandler";
import { optionalAuth, requireAuth, requireProfile } from "../../common/middlewares/auth.middleware";

const router = Router();

const rootOnly = requireProfile("ROOT");
const topManagerOnly = requireProfile("ROOT", "COORDENACAO_GERAL");

router.get("/", optionalAuth, asyncHandler(list));
router.get("/my-requests", requireAuth, asyncHandler(myRequests));
router.get("/my-groups", requireAuth, asyncHandler(myGroups));
router.get("/:id", optionalAuth, asyncHandler(getById));
router.post("/", requireAuth, rootOnly, asyncHandler(create));
router.patch("/:id", requireAuth, asyncHandler(update));
router.delete("/:id", requireAuth, topManagerOnly, asyncHandler(remove));

router.delete("/:id/members/:memberId", requireAuth, asyncHandler(removeMember));
router.post("/:id/requests", requireAuth, asyncHandler(requestToJoin));
router.get("/:id/requests", requireAuth, asyncHandler(listRequests));
router.patch("/:id/requests/:requestId", requireAuth, asyncHandler(updateRequestStatus));

export default router;
