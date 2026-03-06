import { Request, Response } from "express";
import { RewardService } from "./rewardService.js";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";

export class RewardController {
    static async getBalance(req: Request, res: Response) {
        const { user_id } = req.body;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: Number(user_id) });

        if (!user) return res.json({ success: 0, msg: "User not found" });

        return res.json({
            success: 1,
            result: [user]
        });
    }

    static async claimDaily(req: Request, res: Response) {
        const { user_id } = req.body;
        try {
            const balance = await RewardService.claimDailyReward(Number(user_id));
            return res.json({ success: 1, msg: "Claimed successfully", balance });
        } catch (e: any) {
            return res.json({ success: 0, msg: e.message });
        }
    }

    // Placeholder for deposit/withdraw
    static async postDeposit(req: Request, res: Response) {
        return res.json({ success: 1, msg: "Deposit initiated" });
    }

    static async postWithdraw(req: Request, res: Response) {
        return res.json({ success: 1, msg: "Withdrawal request received" });
    }
}
