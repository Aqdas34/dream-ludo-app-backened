import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { GemTransaction } from "../../entities/GemTransaction.js";
import { GemPackage } from "../../entities/GemPackage.js";
import { Purchase } from "../../entities/Purchase.js";
import { RewardHistory, RewardType } from "../../entities/RewardHistory.js";
import { UserAchievement } from "../../entities/UserAchievement.js";
import { Achievement } from "../../entities/Achievement.js";

export enum TransactionType {
    PURCHASE = "purchase",
    REWARD = "reward",
    SPEND = "spend",
    REFUND = "refund"
}

export class EnhancedRewardService {
    // ── User Data ────────────────────────────────────────────────
    static async getGemBalance(userId: string) {
        const user = await AppDataSource.getRepository(User).findOneBy({ id: Number(userId) });
        return user?.gems || 0;
    }

    static async addGems(userId: string, amount: number, type: TransactionType, description?: string, referenceId?: string) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: Number(userId) });
            if (!user) throw new Error("User not found");

            user.gems = (user.gems || 0) + amount;
            if (user.gems < 0) throw new Error("Insufficient gem balance");

            await manager.save(user);

            // SYNC TO USERPROFILE
            try {
                const { UserProfile } = await import("../../entities/UserProfile.js");
                const profile = await manager.findOneBy(UserProfile, { user_id: userId });
                if (profile) {
                    profile.gems_balance = user.gems;
                    await manager.save(profile);
                    console.log(`📡 [SYNC] UserProfile gems updated for ${userId}: ${user.gems}`);
                }
            } catch (err) {
                console.error("⚠️ Failed to sync UserProfile gems:", err);
            }

            // Log in Legacy Transaction table
            const transaction = manager.create(GemTransaction, {
                user_id: userId,
                amount: amount,
                transaction_type: type,
                description: description,
                reference_id: referenceId
            });
            await manager.save(transaction);

            // Log in User Reward History
            let historyType = RewardType.DAILY_LOGIN; // Fallback
            if (type === TransactionType.PURCHASE) historyType = RewardType.PURCHASE;
            if (description?.includes("Win")) historyType = RewardType.GAME_WIN;

            const history = manager.create(RewardHistory, {
                user: user,
                type: historyType,
                amount: amount,
                description: description || "Gems adjustment"
            });
            await manager.save(history);

            return user.gems;
        });
    }

    // ── Daily Reward System ───────────────────────────────────────
    static async claimDailyReward(userId: string) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: Number(userId) });
            if (!user) throw new Error("User not found");

            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const lastClaimDate = user.lastDailyClaim ? user.lastDailyClaim.toISOString().split('T')[0] : null;

            if (lastClaimDate === today) {
                throw new Error("Already claimed today");
            }

            // Check streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastClaimDate === yesterdayStr) {
                user.streakDays += 1;
            } else {
                user.streakDays = 1;
            }

            // Reward calculation: Base 10 + (streak * 5)
            const rewardAmount = 10 + Math.min(user.streakDays - 1, 6) * 5;

            user.lastDailyClaim = now;
            user.gems = (user.gems || 0) + rewardAmount;
            await manager.save(user);

            // SYNC TO USERPROFILE
            try {
                const { UserProfile } = await import("../../entities/UserProfile.js");
                const profile = await manager.findOneBy(UserProfile, { user_id: userId });
                if (profile) {
                    profile.gems_balance = user.gems;
                    await manager.save(profile);
                }
            } catch (err) {}

            // Record history
            const history = manager.create(RewardHistory, {
                user: user,
                type: RewardType.DAILY_LOGIN,
                amount: rewardAmount,
                description: `Daily Reward (Day ${user.streakDays})`
            });
            await manager.save(history);

            return { streak: user.streakDays, reward: rewardAmount, totalGems: user.gems };
        });
    }

    // ── Game Stats & Rewards ──────────────────────────────────────
    static async updateGameRewards(userId: string, isWinner: boolean) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: Number(userId) });
            if (!user) throw new Error("User not found");

            const gemReward = isWinner ? 10 : 2;
            const xpReward = isWinner ? 100 : 25;

            user.totalGames += 1;
            if (isWinner) user.totalWins += 1;
            user.experience += xpReward;

            // Level up logic: every 1000 XP
            user.level = Math.floor(user.experience / 1000) + 1;
            user.gems = (user.gems || 0) + gemReward;

            await manager.save(user);

            // SYNC TO USERPROFILE
            try {
                const { UserProfile } = await import("../../entities/UserProfile.js");
                const profile = await manager.findOneBy(UserProfile, { user_id: userId });
                if (profile) {
                    profile.gems_balance = user.gems;
                    profile.total_games_played = user.totalGames;
                    profile.total_wins = user.totalWins;
                    profile.level = user.level;
                    profile.experience_points = user.experience;
                    await manager.save(profile);
                }
            } catch (err) {}

            const history = manager.create(RewardHistory, {
                user: user,
                type: isWinner ? RewardType.GAME_WIN : RewardType.GAME_PARTICIPATION,
                amount: gemReward,
                description: isWinner ? "Game Win Reward" : "Game Participation Reward"
            });
            await manager.save(history);

            return { gems: user.gems, level: user.level, wins: user.totalWins };
        });
    }

    // ── Gem Purchases ─────────────────────────────────────────────
    static async processPurchase(userId: string, packageId: string, transactionId: string) {
        return await AppDataSource.transaction(async (manager) => {
            console.log(`💎 [REWARD] Starting Fulfillment Process for User ${userId}`);
            
            const user = await manager.findOneBy(User, { id: Number(userId) });
            if (!user) throw new Error("User not found");

            // IDEMPOTENCY CHECK: Prevent duplicate gems if multiple processes hit this at once
            if (transactionId) {
                const existing = await manager.findOneBy(Purchase, { transaction_id: transactionId, status: "completed" });
                if (existing) {
                    console.warn(`🛑 [REWARD] Transaction ${transactionId} already fulfilled. Skipping.`);
                    return { gemsAdded: 0, totalGems: user.gems };
                }
            }

            const pkg = await manager.findOneBy(GemPackage, { id: packageId });
            if (!pkg) throw new Error("Invalid gem package");

            const totalGemsAdded = pkg.gems_amount + pkg.bonus_gems;

            const purchase = manager.create(Purchase, {
                user_id: userId,
                gem_package_id: packageId,
                gems_amount: totalGemsAdded,
                price: pkg.price,
                currency: pkg.currency,
                transaction_id: transactionId,
                status: "completed"
            });
            await manager.save(purchase);

            const oldGems = user.gems || 0;
            user.gems = oldGems + totalGemsAdded;
            await manager.save(user);

            // SYNC TO USERPROFILE (Crucial for App Visibility)
            try {
                const { UserProfile } = await import("../../entities/UserProfile.js");
                const profile = await manager.findOneBy(UserProfile, { user_id: userId });
                if (profile) {
                    profile.gems_balance = user.gems;
                    await manager.save(profile);
                    console.log(`✅ [SYNC] UserProfile synchronized! New Balance: ${user.gems}`);
                } else {
                    console.warn(`⚠️ [SYNC] UserProfile NOT FOUND for ${userId}. Creating one...`);
                    const newProfile = manager.create(UserProfile, {
                        user_id: userId,
                        gems_balance: user.gems,
                        display_name: user.fullName || user.username
                    });
                    await manager.save(newProfile);
                }
            } catch (err) {
                console.error("🔥 [SYNC] UserProfile update failed:", err);
            }

            const history = manager.create(RewardHistory, {
                user: user,
                type: RewardType.PURCHASE,
                amount: totalGemsAdded,
                description: `Purchase: ${pkg.name}`
            });
            await manager.save(history);

            console.log(`🎉 [SUCCESS] Gems Added! ${oldGems} -> ${user.gems}`);
            return { gemsAdded: totalGemsAdded, totalGems: user.gems };
        });
    }

    static async getGemHistory(userId: string) {
        const repo = AppDataSource.getRepository(RewardHistory);
        return await repo.find({
            where: { user: { id: Number(userId) } },
            order: { createdAt: "DESC" },
            take: 20
        });
    }

    // ── Achievements System ───────────────────────────────────────
    static async getUserAchievements(userId: string) {
        try {
            const uaRepo = AppDataSource.getRepository(UserAchievement);
            const achRepo = AppDataSource.getRepository(Achievement);

            // 1. Ensure "welcome" achievement exists
            let welcomeAch = await achRepo.findOneBy({ achievement_key: "welcome" });
            if (!welcomeAch) {
                welcomeAch = achRepo.create({
                    achievement_key: "welcome",
                    name: "Welcome to XLudo",
                    description: "Thanks for joining us! Here's a small gift to start.",
                    category: "special",
                    reward_gems: 50,
                    reward_xp: 100,
                    max_progress: 1,
                    is_hidden: false
                });
                await achRepo.save(welcomeAch);
            }

            // 2. Fetch all non-hidden achievements
            const allAchievements = await achRepo.find({ where: { is_hidden: false } });

            // 3. Ensure user has entries
            const existingUas = await uaRepo.find({ where: { user_id: userId } });
            const existingAchIds = new Set(existingUas.map(ua => ua.achievement_id));

            for (const ach of allAchievements) {
                if (!existingAchIds.has(ach.id)) {
                    const isWelcome = ach.achievement_key === "welcome";
                    const newUa = uaRepo.create({
                        user_id: userId,
                        achievement_id: ach.id,
                        achievement: ach,
                        current_progress: isWelcome ? 1 : 0,
                        is_completed: isWelcome, 
                        claimed_reward: false
                    });
                    await uaRepo.save(newUa);
                }
            }

            // 4. Return progress (Ordered by id since created_at was just added)
            return await uaRepo.find({
                where: { user_id: userId },
                relations: ["achievement"],
                order: { id: "ASC" }
            });
        } catch (error) {
            console.error("❌ Error in getUserAchievements:", error);
            throw error;
        }
    }

    static async claimAchievementReward(userId: string, userAchievementId: string) {
        return await AppDataSource.transaction(async (manager) => {
            const uaRepo = manager.getRepository(UserAchievement);
            const ua = await uaRepo.findOne({
                where: { id: userAchievementId, user_id: userId },
                relations: ["achievement"]
            });

            if (!ua) throw new Error("Achievement not found");
            if (!ua.is_completed) throw new Error("Achievement not yet completed");
            if (ua.claimed_reward) throw new Error("Reward already claimed");

            const user = await manager.findOneBy(User, { id: Number(userId) });
            if (!user) throw new Error("User not found");

            ua.claimed_reward = true;
            await manager.save(ua);

            const gemReward = ua.achievement.reward_gems;
            const xpReward = ua.achievement.reward_xp;

            user.gems = (user.gems || 0) + gemReward;
            user.experience += xpReward;
            user.level = Math.floor(user.experience / 1000) + 1;
            await manager.save(user);

            const history = manager.create(RewardHistory, {
                user: user,
                type: RewardType.REFERRAL, // Closest match or add new type
                amount: gemReward,
                description: `Achievement: ${ua.achievement.name}`
            });
            await manager.save(history);

            return { gems: user.gems, level: user.level, claimed: true };
        });
    }
}
