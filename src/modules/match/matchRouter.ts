import { Router } from "express";
import { MatchController } from "./matchController.js";

const router = Router();

router.get("/get_history", MatchController.getHistory);
router.get("/get_match_upcoming", MatchController.getUpcoming);
router.get("/get_match_ongoing", MatchController.getOngoing);
router.get("/get_match_completed", MatchController.getCompleted);
router.post("/post_join_match", MatchController.joinMatch);
router.post("/delete_participant", MatchController.leaveMatch);
router.post("/post_result", MatchController.submitResult);
router.post("/create_test_matches", MatchController.createTestMatches);
router.get("/get_notifications", MatchController.getNotifications);

export default router;
