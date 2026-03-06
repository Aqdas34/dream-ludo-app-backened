import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { Match } from "../../entities/Match.js";

export class AdminController {
    static async getStats(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const matchRepository = AppDataSource.getRepository(Match);

            const totalUsers = await userRepository.count();
            const totalMatches = await matchRepository.count();

            // Simple sum for balances - in a real app you'd use a more optimized query
            const users = await userRepository.find();
            const totalDepositBal = users.reduce((acc, user) => acc + Number(user.depositBal || 0), 0);
            const totalWonBal = users.reduce((acc, user) => acc + Number(user.wonBal || 0), 0);

            return res.json({
                success: 1,
                stats: {
                    totalUsers,
                    totalMatches,
                    totalDepositBal,
                    totalWonBal
                }
            });
        } catch (error) {
            console.error("Admin stats error:", error);
            return res.status(500).json({ success: 0, msg: "Failed to fetch admin stats" });
        }
    }

    static async getAllUsers(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const users = await userRepository.find({
                order: { createdAt: "DESC" }
            });
            return res.json({ success: 1, users });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch users" });
        }
    }
}
