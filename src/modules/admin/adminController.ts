import { Request, Response } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Match } from "../../entities/Match.js";
import { RewardHistory } from "../../entities/RewardHistory.js";
import { Notification } from "../../entities/Notification.js";
import { Achievement } from "../../entities/Achievement.js";
import { GemPackage } from "../../entities/GemPackage.js";
import { Purchase } from "../../entities/Purchase.js";
import { redis } from "../../config/redis.js";

export class AdminController {
    static async login(req: Request, res: Response) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ success: 0, msg: "Username and password required" });
            }

            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOne({
                where: [{ username }, { email: username }],
                select: ["id", "username", "email", "fullName", "password", "isAdmin"]
            });

            if (!user) {
                return res.status(401).json({ success: 0, msg: "Invalid credentials" });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ success: 0, msg: "Invalid credentials" });
            }

            if (!user.isAdmin) {
                return res.status(403).json({ success: 0, msg: "User is not an admin" });
            }

            const token = jwt.sign(
                { id: user.id, isAdmin: true },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '1d' }
            );

            return res.json({
                success: 1,
                msg: "Admin login successful",
                result: [{
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    token
                }]
            });
        } catch (error) {
            console.error("Admin login error:", error);
            return res.status(500).json({ success: 0, msg: "Admin login failed" });
        }
    }

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

    // --- User Management ---
    static async deleteUser(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOneBy({ id: Number(id) });
            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            await userRepository.remove(user);
            return res.json({ success: 1, msg: "User deleted successfully" });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to delete user" });
        }
    }

    // --- Achievement Management ---
    static async getAllAchievements(req: Request, res: Response) {
        try {
            const achievementRepo = AppDataSource.getRepository(Achievement);
            const achievements = await achievementRepo.find({ order: { id: "DESC" } });
            return res.json({ success: 1, achievements });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch achievements" });
        }
    }

    static async createAchievement(req: Request, res: Response) {
        try {
            const { name, achievement_key, description, icon_url, reward_gems, category, max_progress } = req.body;
            const achievementRepo = AppDataSource.getRepository(Achievement);

            const achievement = achievementRepo.create({
                name,
                achievement_key,
                description,
                icon_url,
                reward_gems: Number(reward_gems),
                category,
                max_progress: Number(max_progress)
            });

            await achievementRepo.save(achievement);
            return res.json({ success: 1, achievement });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to create achievement" });
        }
    }

    static async deleteAchievement(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const achievementRepo = AppDataSource.getRepository(Achievement);
            const achievement = await achievementRepo.findOneBy({ id: id as string });
            if (!achievement) return res.status(404).json({ success: 0, msg: "Achievement not found" });

            await achievementRepo.remove(achievement);
            return res.json({ success: 1, msg: "Achievement deleted" });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to delete achievement" });
        }
    }

    // --- Gem Package Management ---
    static async getAllGemPackages(req: Request, res: Response) {
        try {
            const packageRepo = AppDataSource.getRepository(GemPackage);
            const packages = await packageRepo.find({ order: { sort_order: "ASC" } });
            return res.json({ success: 1, packages });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch gem packages" });
        }
    }

    static async createGemPackage(req: Request, res: Response) {
        try {
            const { id, name, gems_amount, bonus_gems, price, currency, is_popular, sort_order, is_active } = req.body;
            const packageRepo = AppDataSource.getRepository(GemPackage);

            const pkg = packageRepo.create({
                id,
                name,
                gems_amount: Number(gems_amount),
                bonus_gems: Number(bonus_gems || 0),
                price: Number(price),
                currency: currency || "USD",
                is_popular: !!is_popular,
                sort_order: Number(sort_order || 0),
                is_active: is_active !== undefined ? !!is_active : true
            });

            await packageRepo.save(pkg);
            return res.json({ success: 1, package: pkg });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to create gem package" });
        }
    }

    static async updateGemPackage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const packageRepo = AppDataSource.getRepository(GemPackage);
            
            const pkg = await packageRepo.findOneBy({ id: id as string });
            if (!pkg) return res.status(404).json({ success: 0, msg: "Package not found" });

            Object.assign(pkg, updateData);
            await packageRepo.save(pkg);
            
            return res.json({ success: 1, package: pkg });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to update gem package" });
        }
    }

    static async deleteGemPackage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const packageRepo = AppDataSource.getRepository(GemPackage);
            const pkg = await packageRepo.findOneBy({ id: id as string });
            if (!pkg) return res.status(404).json({ success: 0, msg: "Package not found" });

            await packageRepo.remove(pkg);
            return res.json({ success: 1, msg: "Gem package deleted" });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to delete gem package" });
        }
    }

    // --- Transaction Management ---
    static async getAllPurchases(req: Request, res: Response) {
        try {
            const purchaseRepo = AppDataSource.getRepository(Purchase);
            const purchases = await purchaseRepo.find({
                order: { created_at: "DESC" },
                take: 200
            });
            return res.json({ success: 1, purchases });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed to fetch purchases" });
        }
    }

    static async deletePurchase(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const purchaseRepo = AppDataSource.getRepository(Purchase);
            const purchase = await purchaseRepo.findOneBy({ id: id as string });
            
            if (!purchase) return res.status(404).json({ success: 0, msg: "Purchase not found" });

            await purchaseRepo.remove(purchase);
            return res.json({ success: 1, msg: "Transaction deleted successfully" });
        } catch (error) {
            console.error("Delete purchase error:", error);
            return res.status(500).json({ success: 0, msg: "Failed to delete transaction" });
        }
    }

    static async verifyPurchaseStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const purchaseRepo = AppDataSource.getRepository(Purchase);
            const purchase = await purchaseRepo.findOneBy({ id: id as string });

            if (!purchase) return res.status(404).json({ success: 0, msg: "Transaction not found" });
            if (purchase.status === "completed") return res.json({ success: 1, msg: "Transaction already completed" });

            const { PaylinkService } = await import("../payments/paylinkService.js");
            const { EnhancedRewardService } = await import("../rewards/enhancedRewardService.js");
            const { io } = await import("../../config/socket.js");

            // Check with Paylink API
            const invoiceId = purchase.invoice_id || purchase.id;
            console.log(`🏦 Manual Verification Triggered for Order: ${purchase.id}. Using ID: ${invoiceId}`);
            
            const statusResponse = await PaylinkService.getInvoiceStatus(invoiceId);
            console.log(`🏦 Manual Check [${invoiceId}] Bank Status: ${statusResponse.orderStatus}`);

            if (statusResponse.orderStatus && statusResponse.orderStatus.toString().toLowerCase() === "paid") {
                // Fulfill it now!
                const result = await EnhancedRewardService.processPurchase(
                    purchase.user_id,
                    purchase.gem_package_id,
                    invoiceId
                );

                purchase.status = "completed";
                purchase.transaction_id = invoiceId;
                await purchaseRepo.save(purchase);

                // Notify User
                io.to(`user_${purchase.user_id}`).emit("balance_update", {
                    gems: result.totalGems,
                    message: "Payment verified by administrator!"
                });

                return res.json({ success: 1, msg: "Payment Verified! Gems added.", status: "paid" });
            }

            return res.json({ success: 1, msg: `Bank Status: ${statusResponse.orderStatus}`, status: statusResponse.orderStatus });
        } catch (error: any) {
            console.error("Manual verify error:", error.message);
            return res.status(500).json({ success: 0, msg: "Verification failed: " + error.message });
        }
    }
}
