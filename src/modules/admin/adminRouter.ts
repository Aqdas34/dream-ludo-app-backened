import { Router } from "express";
import { AdminController } from "./adminController.js";

const router = Router();

router.get("/stats", AdminController.getStats);
router.get("/users", AdminController.getAllUsers);
router.post("/users/update-balance", AdminController.updateUserBalance);
router.post("/users/toggle-ban", AdminController.toggleUserBan);
router.get("/games/live", AdminController.getLiveGames);
router.get("/audit-logs", AdminController.getAuditLogs);
router.post("/broadcast", AdminController.broadcastMessage);
router.get("/broadcasts", AdminController.getBroadcastHistory);

export default router;
