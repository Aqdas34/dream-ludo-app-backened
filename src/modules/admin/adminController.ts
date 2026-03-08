import { Request, Response } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { Match } from "../../entities/Match.js";
import { RewardHistory } from "../../entities/RewardHistory.js";
import { Notification } from "../../entities/Notification.js";
import { redis } from "../../config/redis.js";

export class AdminController {
    static async getStats(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const matchRepository = AppDataSource.getRepository(Match);

            const totalUsers = await userRepository.count();
            const totalMatches = await matchRepository.count();

            const stats = await userRepository.createQueryBuilder("user")
                .select("SUM(user.depositBal)", "totalDeposit")
                .addSelect("SUM(user.wonBal)", "totalWon")
                .addSelect("SUM(user.bonusBal)", "totalBonus")
                .addSelect("SUM(user.gems)", "totalGems")
                .getRawOne();

            // Active users today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeToday = await userRepository.createQueryBuilder("user")
                .where("user.updatedAt >= :today", { today })
                .getCount();

            return res.json({
                success: 1,
                stats: {
                    totalUsers,
                    activeToday,
                    totalMatches,
                    totalDepositBal: Number(stats?.totalDeposit || 0),
                    totalWonBal: Number(stats?.totalWon || 0),
                    totalBonusBal: Number(stats?.totalBonus || 0),
                    totalGems: Number(stats?.totalGems || 0)
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

    static async updateUserBalance(req: Request, res: Response) {
        try {
            const { userId, deposit, won, bonus, gems } = req.body;
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOneBy({ id: Number(userId) });

            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            if (deposit !== undefined) user.depositBal = deposit;
            if (won !== undefined) user.wonBal = won;
            if (bonus !== undefined) user.bonusBal = bonus;
            if (gems !== undefined) user.gems = gems;

            await userRepository.save(user);
            return res.json({ success: 1, msg: "Balances updated", user });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Update failed" });
        }
    }

    static async toggleUserBan(req: Request, res: Response) {
        try {
            const { userId, isBanned } = req.body;
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOneBy({ id: Number(userId) });

            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            user.isBanned = isBanned;
            await userRepository.save(user);

            return res.json({ success: 1, msg: `User ${isBanned ? 'banned' : 'unbanned'}` });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Toggle ban failed" });
        }
    }

    static async getLiveGames(req: Request, res: Response) {
        try {
            const keys = await redis.keys("room:*");
            const rooms = [];
            for (const key of keys) {
                const data = await redis.get(key);
                if (data) rooms.push(JSON.parse(data));
            }
            return res.json({ success: 1, count: rooms.length, rooms });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch live rooms" });
        }
    }

    static async getAuditLogs(req: Request, res: Response) {
        try {
            const auditRepository = AppDataSource.getRepository(RewardHistory);
            const logs = await auditRepository.find({
                relations: ["user"],
                order: { createdAt: "DESC" },
                take: 100
            });
            return res.json({ success: 1, logs });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch audit logs" });
        }
    }

    static async getBroadcastHistory(req: Request, res: Response) {
        try {
            const notifications = await AppDataSource.getRepository(Notification).find({
                where: { user: IsNull() }, // user is null in DB means global
                order: { createdAt: "DESC" },
                take: 20
            });
            return res.json({ success: 1, notifications });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch broadcasts" });
        }
    }

    static async broadcastMessage(req: Request, res: Response) {
        try {
            const { message, title, type } = req.body;
            const { NotificationService } = await import("../notifications/notificationService.js");

            await NotificationService.sendGlobalBroadcast(
                title || "System Announcement",
                message,
                type || "info"
            );

            return res.json({ success: 1, msg: "Broadcast sent and saved" });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to send broadcast" });
        }
    }
}
