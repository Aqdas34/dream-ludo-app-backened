import { Router } from "express";
import { RewardController } from "./rewardController.js";
import { EnhancedRewardController } from "./enhancedRewardController.js";

const router = Router();

// Legacy routes (maintain for compatibility if needed)
router.post("/post_balance", RewardController.getBalance);
router.post("/claim_daily", RewardController.claimDaily);

// New Enhanced Reward System Routes
router.get("/gems/balance/:userId", EnhancedRewardController.getBalance);
router.post("/gems/claim-daily", EnhancedRewardController.claimDaily);
router.post("/gems/verify-purchase", EnhancedRewardController.verifyPurchase);
router.get("/gems/history/:userId", EnhancedRewardController.getHistory);
router.get("/gems/achievements/:userId", EnhancedRewardController.getAchievements);
router.post("/gems/claim-achievement", EnhancedRewardController.claimAchievement);

// Public Gem Packages
router.get("/gems/packages", EnhancedRewardController.getGemPackages);

export default router;
