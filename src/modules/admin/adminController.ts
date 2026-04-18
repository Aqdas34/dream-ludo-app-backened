import { Request, Response } from "express";
import { IsNull } from "typeorm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { redis } from "../../config/redis.js";
import { EmailService } from "../../utils/emailService.js";

// Helper for logging that uses dynamic import to avoid ANY circular dependencies
async function safeLog(adminId: number, action: string, targetId: string, details: any) {
    try {
        const { recordAdminLog } = await import("../../utils/adminLog.js");
        await recordAdminLog(adminId, action, targetId, details);
    } catch (e) {
        console.error("LOGGING ERROR:", e);
    }
}

// Helper to get AppDataSource dynamically
async function getDS() {
    const { AppDataSource } = await import("../../data-source.js");
    return AppDataSource;
}

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");

        if (!username || !password) {
            return res.status(400).json({ success: 0, msg: "Username and password required" });
        }

        const userRepository = ds.getRepository(User);
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
};

export const getStats = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const { Match } = await import("../../entities/Match.js");
        
        const userRepository = ds.getRepository(User);
        const matchRepository = ds.getRepository(Match);

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
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const userRepository = ds.getRepository(User);
        const users = await userRepository.find({
            order: { createdAt: "DESC" }
        });
        return res.json({ success: 1, users });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to fetch users" });
    }
};

export const updateUserBalance = async (req: Request, res: Response) => {
    try {
        const { userId, deposit, won, bonus, gems } = req.body;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const userRepository = ds.getRepository(User);
        const user = await userRepository.findOneBy({ id: Number(userId) });

        if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

        if (deposit !== undefined) user.depositBal = deposit;
        if (won !== undefined) user.wonBal = won;
        if (bonus !== undefined) user.bonusBal = bonus;
        if (gems !== undefined) user.gems = gems;

        await userRepository.save(user);

        // Record Log
        await safeLog(Number((req as any).userId), "UPDATE_BALANCE", userId.toString(), { deposit, won, bonus, gems });

        return res.json({ success: 1, msg: "Balances updated", user });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Update failed" });
    }
};

export const toggleUserBan = async (req: Request, res: Response) => {
    try {
        const { userId, isBanned } = req.body;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const userRepository = ds.getRepository(User);
        const user = await userRepository.findOneBy({ id: Number(userId) });

        if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

        user.isBanned = isBanned;
        await userRepository.save(user);

        // Record Log
        await safeLog(Number((req as any).userId), "TOGGLE_BAN", userId.toString(), { isBanned });

        return res.json({ success: 1, msg: `User ${isBanned ? 'banned' : 'unbanned'}` });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Toggle ban failed" });
    }
};

export const getLiveGames = async (req: Request, res: Response) => {
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
};

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        // Using raw query to fetch audit logs to avoid importing the entity class
        const logs = await ds.query(
            `SELECT * FROM audit_logs ORDER BY "createdAt" DESC LIMIT 100`
        );
        return res.json({ success: 1, logs });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to fetch audit logs" });
    }
};

export const getBroadcastHistory = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        const { Notification } = await import("../../entities/Notification.js");
        const notifications = await ds.getRepository(Notification).find({
            where: { user: IsNull() }, // user is null in DB means global
            order: { createdAt: "DESC" },
            take: 20
        });
        return res.json({ success: 1, notifications });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to fetch broadcasts" });
    }
};

export const broadcastMessage = async (req: Request, res: Response) => {
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
};

export const toggleUserAdmin = async (req: Request, res: Response) => {
    try {
        const { userId, isAdmin } = req.body;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const userRepository = ds.getRepository(User);
        const user = await userRepository.findOneBy({ id: Number(userId) });
        if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

        user.isAdmin = isAdmin;
        await userRepository.save(user);

        // Record Log
        await safeLog(Number((req as any).userId), "TOGGLE_ADMIN", userId.toString(), { isAdmin });

        return res.json({ success: 1, msg: `User role updated to ${isAdmin ? 'Admin' : 'Player'}` });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to update user role" });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = Number(id);
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const userRepository = ds.getRepository(User);
        const user = await userRepository.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

        // Record Log (Persists even if user is gone)
        await safeLog(Number((req as any).userId), "DELETE_USER", id as string, { username: user.username, email: user.email });

        // Use raw queries to avoid circular dependency crashes from importing entities
        await ds.query(`DELETE FROM user_achievements WHERE user_id = $1`, [id]);
        await ds.query(`DELETE FROM reward_histories WHERE "userId" = $1`, [userId]);
        await ds.query(`DELETE FROM game_histories WHERE "userId" = $1`, [id]);
        await ds.query(`DELETE FROM gem_transactions WHERE user_id = $1`, [id]);
        await ds.query(`DELETE FROM purchases WHERE user_id = $1`, [id]);
        await ds.query(`DELETE FROM user_profiles WHERE user_id = $1`, [id]);

        await userRepository.remove(user);
        return res.json({ success: 1, msg: "User deleted successfully" });
    } catch (error) {
        console.error("DELETE USER ERROR:", error);
        return res.status(500).json({ success: 0, msg: "Unable to delete user. The account might have active dependencies." });
    }
};

export const getAllAchievements = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        const { Achievement } = await import("../../entities/Achievement.js");
        const achievementRepo = ds.getRepository(Achievement);
        const achievements = await achievementRepo.find({ order: { id: "DESC" } });
        return res.json({ success: 1, achievements });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to fetch achievements" });
    }
};

export const createAchievement = async (req: Request, res: Response) => {
    try {
        const { name, achievement_key, description, icon_url, reward_gems, category, max_progress } = req.body;
        const ds = await getDS();
        const { Achievement } = await import("../../entities/Achievement.js");
        const achievementRepo = ds.getRepository(Achievement);

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
};

export const deleteAchievement = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ds = await getDS();
        const { Achievement } = await import("../../entities/Achievement.js");
        const achievementRepo = ds.getRepository(Achievement);
        const achievement = await achievementRepo.findOneBy({ id: id as string });
        if (!achievement) return res.status(404).json({ success: 0, msg: "Achievement not found" });

        await achievementRepo.remove(achievement);
        return res.json({ success: 1, msg: "Achievement deleted" });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to delete achievement" });
    }
};

export const getAllGemPackages = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        const { GemPackage } = await import("../../entities/GemPackage.js");
        const packageRepo = ds.getRepository(GemPackage);
        const packages = await packageRepo.find({ order: { sort_order: "ASC" } });
        return res.json({ success: 1, packages });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to fetch gem packages" });
    }
};

export const createGemPackage = async (req: Request, res: Response) => {
    try {
        const { id, name, gems_amount, bonus_gems, price, currency, is_popular, sort_order, is_active } = req.body;
        const ds = await getDS();
        const { GemPackage } = await import("../../entities/GemPackage.js");
        const packageRepo = ds.getRepository(GemPackage);

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
};

export const updateGemPackage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const ds = await getDS();
        const { GemPackage } = await import("../../entities/GemPackage.js");
        const packageRepo = ds.getRepository(GemPackage);

        const pkg = await packageRepo.findOneBy({ id: id as string });
        if (!pkg) return res.status(404).json({ success: 0, msg: "Package not found" });

        Object.assign(pkg, updateData);
        await packageRepo.save(pkg);

        return res.json({ success: 1, package: pkg });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to update gem package" });
    }
};

export const deleteGemPackage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ds = await getDS();
        const { GemPackage } = await import("../../entities/GemPackage.js");
        const packageRepo = ds.getRepository(GemPackage);
        const pkg = await packageRepo.findOneBy({ id: id as string });
        if (!pkg) return res.status(404).json({ success: 0, msg: "Package not found" });

        await packageRepo.remove(pkg);
        return res.json({ success: 1, msg: "Gem package deleted" });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to delete gem package" });
    }
};

export const getAllPurchases = async (req: Request, res: Response) => {
    try {
        const ds = await getDS();
        const { Purchase } = await import("../../entities/Purchase.js");
        const purchaseRepo = ds.getRepository(Purchase);
        const purchases = await purchaseRepo.find({
            order: { created_at: "DESC" },
            take: 200
        });
        return res.json({ success: 1, purchases });
    } catch (error) {
        return res.status(500).json({ success: 0, msg: "Failed to fetch purchases" });
    }
};

export const deletePurchase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ds = await getDS();
        const { Purchase } = await import("../../entities/Purchase.js");
        const purchaseRepo = ds.getRepository(Purchase);
        const purchase = await purchaseRepo.findOneBy({ id: id as string });

        if (!purchase) return res.status(404).json({ success: 0, msg: "Purchase not found" });

        await purchaseRepo.remove(purchase);
        return res.json({ success: 1, msg: "Transaction deleted successfully" });
    } catch (error) {
        console.error("Delete purchase error:", error);
        return res.status(500).json({ success: 0, msg: "Failed to delete transaction" });
    }
};

export const verifyPurchaseStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ds = await getDS();
        const { Purchase } = await import("../../entities/Purchase.js");
        const purchaseRepo = ds.getRepository(Purchase);
        const purchase = await purchaseRepo.findOneBy({ id: id as string });

        if (!purchase) return res.status(404).json({ success: 0, msg: "Transaction not found" });
        if (purchase.status === "completed") return res.json({ success: 1, msg: "Transaction already completed" });

        const { PaylinkService } = await import("../payments/paylinkService.js");
        const { EnhancedRewardService } = await import("../rewards/enhancedRewardService.js");
        const { io } = await import("../../config/socket.js");

        // Check with Paylink API
        const invoiceId = purchase.invoice_id || purchase.id;
        const statusResponse = await PaylinkService.getInvoiceStatus(invoiceId);

        if (statusResponse.orderStatus && statusResponse.orderStatus.toString().toLowerCase() === "paid") {
            const result = await EnhancedRewardService.processPurchase(
                purchase.user_id,
                purchase.gem_package_id,
                invoiceId
            );

            purchase.status = "completed";
            purchase.transaction_id = invoiceId;
            await purchaseRepo.save(purchase);

            io.to(`user_${purchase.user_id}`).emit("balance_update", {
                gems: result.totalGems,
                message: "Payment verified by administrator!"
            });

            return res.json({ success: 1, msg: "Payment Verified! Gems added.", status: "paid" });
        }

        return res.json({ success: 1, msg: `Bank Status: ${statusResponse.orderStatus}`, status: statusResponse.orderStatus });
    } catch (error: any) {
        return res.status(500).json({ success: 0, msg: "Verification failed: " + error.message });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const { email, password } = req.body;
        const userId = req.userId;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");

        if (!userId) {
            return res.status(401).json({ success: 0, msg: "Unauthorized access" });
        }

        const userRepository = ds.getRepository(User);
        const user = await userRepository.findOneBy({ id: Number(userId) });

        if (!user) {
            return res.status(404).json({ success: 0, msg: "Administrator record not found" });
        }

        if (email) {
            const existingUser = await userRepository.findOne({ where: { email } });
            if (existingUser && existingUser.id !== user.id) {
                return res.status(400).json({ success: 0, msg: "Email already in use" });
            }
            user.email = email;
        }

        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await userRepository.save(user);
        return res.json({
            success: 1,
            msg: "Profile updated successfully",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName
            }
        });
    } catch (error: any) {
        return res.status(500).json({ success: 0, msg: "Internal server error" });
    }
};

export const requestForgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const { AdminOTP } = await import("../../entities/AdminOTP.js");

        if (!email) {
            return res.status(400).json({ success: 0, msg: "Email required" });
        }

        const userRepository = ds.getRepository(User);
        const admin = await userRepository.findOne({ where: { email, isAdmin: true } });

        if (!admin) {
            return res.status(404).json({ success: 0, msg: "Admin not found" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const otpRepository = ds.getRepository(AdminOTP);
        await otpRepository.delete({ email });

        const otpEntry = otpRepository.create({ email, otp, expiresAt });
        await otpRepository.save(otpEntry);

        await EmailService.sendOTP(email, otp);
        return res.json({ success: 1, msg: "Security code sent" });
    } catch (error: any) {
        return res.status(500).json({ success: 0, msg: "Error sending code" });
    }
};

export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const ds = await getDS();
        const { AdminOTP } = await import("../../entities/AdminOTP.js");

        const otpRepository = ds.getRepository(AdminOTP);
        const validOTP = await otpRepository.findOne({ where: { email, otp } });

        if (!validOTP || new Date() > validOTP.expiresAt) {
            return res.status(400).json({ success: 0, msg: "Invalid or expired code" });
        }

        return res.json({ success: 1, msg: "Code verified" });
    } catch (error: any) {
        return res.status(500).json({ success: 0, msg: "Verification failed" });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp, password } = req.body;
        const ds = await getDS();
        const { User } = await import("../../entities/User.js");
        const { AdminOTP } = await import("../../entities/AdminOTP.js");

        const otpRepository = ds.getRepository(AdminOTP);
        const validOTP = await otpRepository.findOne({ where: { email, otp } });

        if (!validOTP || new Date() > validOTP.expiresAt) {
            return res.status(400).json({ success: 0, msg: "Session expired" });
        }

        const userRepository = ds.getRepository(User);
        const admin = await userRepository.findOne({ where: { email, isAdmin: true } });

        if (!admin) return res.status(404).json({ success: 0, msg: "Account not found" });

        admin.password = await bcrypt.hash(password, 10);
        await userRepository.save(admin);
        await otpRepository.delete({ email });

        return res.json({ success: 1, msg: "Password reset successful" });
    } catch (error: any) {
        return res.status(500).json({ success: 0, msg: "Reset failed" });
    }
};
