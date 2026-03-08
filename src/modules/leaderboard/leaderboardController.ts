import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";

export class LeaderboardController {
    static async getTopPlayers(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);

            // Rank by wonBal (Highest Earners)
            const topEarnings = await userRepository.find({
                select: ["id", "username", "fullName", "wonBal", "profileImg", "level"],
                order: { wonBal: "DESC" },
                take: 20
            });

            // Rank by wins
            const topWins = await userRepository.find({
                select: ["id", "username", "fullName", "totalWins", "profileImg", "level"],
                order: { totalWins: "DESC" },
                take: 20
            });

            return res.json({
                earnings: topEarnings,
                wins: topWins
            });
        } catch (error) {
            console.error("Leaderboard Error:", error);
            return res.status(500).json({ message: "Failed to fetch leaderboard" });
        }
    }
}
