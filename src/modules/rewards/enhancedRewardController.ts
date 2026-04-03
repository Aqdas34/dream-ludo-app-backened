import { AppDataSource } from "../../data-source.js";
import { GemPackage } from "../../entities/GemPackage.js";
import { EnhancedRewardService, TransactionType } from "./enhancedRewardService.js";
import { Request, Response } from "express";

export class EnhancedRewardController {
    static async getGemPackages(req: Request, res: Response) {
        try {
            const packageRepo = AppDataSource.getRepository(GemPackage);
            const packages = await packageRepo.find({
                where: { is_active: true },
                order: { sort_order: "ASC" }
            });
            res.json({ success: true, packages });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
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

    static async getHistory(req: Request, res: Response) {
        try {
            const userId = req.params.userId as string;
            const history = await EnhancedRewardService.getGemHistory(userId);
            res.json({ success: true, history });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getAchievements(req: Request, res: Response) {
        try {
            const userId = req.params.userId as string;
            const achievements = await EnhancedRewardService.getUserAchievements(userId);
            res.json({ success: true, achievements });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async claimAchievement(req: Request, res: Response) {
        try {
            const { userId, userAchievementId } = req.body;
            const result = await EnhancedRewardService.claimAchievementReward(userId, userAchievementId);
            res.json({ success: true, ...result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
