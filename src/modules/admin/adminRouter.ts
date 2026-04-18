import { Router } from "express";
import * as AdminController from "./adminController.js";
import { adminAuthMiddleware } from "../../middleware/auth.js";

const router = Router();

router.post("/login", AdminController.login);
router.post("/forgot-password", AdminController.requestForgotPassword);
router.post("/verify-otp", AdminController.verifyOTP);
router.post("/reset-password", AdminController.resetPassword);

router.use(adminAuthMiddleware);

router.get("/stats", AdminController.getStats);
router.get("/users", AdminController.getAllUsers);
router.post("/users/update-balance", AdminController.updateUserBalance);
router.post("/users/toggle-ban", AdminController.toggleUserBan);
router.post("/users/toggle-admin", AdminController.toggleUserAdmin);
router.get("/games/live", AdminController.getLiveGames);
router.get("/audit-logs", AdminController.getAuditLogs);
router.post("/broadcast", AdminController.broadcastMessage);
router.get("/broadcasts", AdminController.getBroadcastHistory);
router.get("/purchases", AdminController.getAllPurchases);

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

router.delete("/purchases/:id", AdminController.deletePurchase);
router.post("/verify-purchase/:id", AdminController.verifyPurchaseStatus);
router.post("/update-profile", AdminController.updateProfile);

export default router;
