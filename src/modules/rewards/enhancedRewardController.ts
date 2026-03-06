import { Request, Response } from "express";
import { EnhancedRewardService, TransactionType } from "./enhancedRewardService.js";

export class EnhancedRewardController {
    static async getBalance(req: Request, res: Response) {
        try {
            const userId = req.params.userId as string;
            const balance = await EnhancedRewardService.getGemBalance(userId);
            res.json({ success: true, balance });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async claimDaily(req: Request, res: Response) {
        try {
            const { userId } = req.body;
            const result = await EnhancedRewardService.claimDailyReward(userId);
            res.json({ success: true, ...result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    static async verifyPurchase(req: Request, res: Response) {
        try {
            const { userId, packageId, transactionId } = req.body;
            const result = await EnhancedRewardService.processPurchase(userId, packageId, transactionId);
            res.json({ success: true, ...result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // Additional leaderboard, achievements endpoints can go here...
}
