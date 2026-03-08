import { Router } from "express";
import { LeaderboardController } from "./leaderboardController.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();

router.get("/leaderboard", authMiddleware as any, LeaderboardController.getTopPlayers);

export default router;
