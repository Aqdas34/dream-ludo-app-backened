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

// Achievements
router.get("/achievements", AdminController.getAllAchievements);
router.post("/achievements", AdminController.createAchievement);
router.delete("/achievements/:id", AdminController.deleteAchievement);

// Advanced User Control
router.delete("/users/:id", AdminController.deleteUser);

// Gem Packages
router.get("/gem-packages", AdminController.getAllGemPackages);
router.post("/gem-packages", AdminController.createGemPackage);
router.patch("/gem-packages/:id", AdminController.updateGemPackage);
router.delete("/gem-packages/:id", AdminController.deleteGemPackage);

export default router;
