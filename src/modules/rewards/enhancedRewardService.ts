import { AppDataSource } from "../../data-source.js";
import { UserProfile } from "../../entities/UserProfile.js";
import { GemTransaction } from "../../entities/GemTransaction.js";
import { DailyReward } from "../../entities/DailyReward.js";
import { GameReward } from "../../entities/GameReward.js";
import { Achievement } from "../../entities/Achievement.js";
import { UserAchievement } from "../../entities/UserAchievement.js";
import { GemPackage } from "../../entities/GemPackage.js";
import { Purchase } from "../../entities/Purchase.js";

export enum TransactionType {
    PURCHASE = "purchase",
    REWARD = "reward",
    SPEND = "spend",
    REFUND = "refund"
}

export class EnhancedRewardService {
    // ── Gem Economy Management ────────────────────────────────────
    static async getGemBalance(userId: string) {
        const profile = await AppDataSource.getRepository(UserProfile).findOneBy({ user_id: userId });
        return profile?.gems_balance || 0;
    }

    static async addGems(userId: string, amount: number, type: TransactionType, description?: string, referenceId?: string) {
        return await AppDataSource.transaction(async (manager) => {
            let profile = await manager.findOneBy(UserProfile, { user_id: userId });
            if (!profile) {
                profile = manager.create(UserProfile, { user_id: userId, gems_balance: 0 });
                await manager.save(profile);
            }

            profile.gems_balance += amount;
            if (profile.gems_balance < 0) throw new Error("Insufficient gem balance");

            await manager.save(profile);

            const transaction = manager.create(GemTransaction, {
                user_id: userId,
                amount: amount,
                transaction_type: type,
                description: description,
                reference_id: referenceId
            });
            await manager.save(transaction);

            return profile.gems_balance;
        });
    }

    // ── Daily Reward System ───────────────────────────────────────
    static async claimDailyReward(userId: string) {
        return await AppDataSource.transaction(async (manager) => {
            let dr = await manager.findOneBy(DailyReward, { user_id: userId });
            const now = new Date();
            const today = now.toISOString().split('T')[0];

            if (dr && dr.last_claimed_date === today) {
                throw new Error("Already claimed today");
            }

            if (!dr) {
                dr = manager.create(DailyReward, { user_id: userId, streak_days: 0 });
            }

            // Check if streak is continued
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (dr.last_claimed_date === yesterdayStr) {
                dr.streak_days += 1;
            } else {
                dr.streak_days = 1;
            }

            const rewardAmount = 10 + Math.min(dr.streak_days - 1, 10) * 5;
            dr.last_claimed_date = today;
            dr.total_claimed += 1;
            await manager.save(dr);

            await this.addGems(userId, rewardAmount, TransactionType.REWARD, `Daily Reward (Day ${dr.streak_days})`);

            return { streak: dr.streak_days, reward: rewardAmount };
        });
    }

    // ── Achievement Management ────────────────────────────────────
    static async trackProgress(userId: string, achievementKey: string, increment: number = 1) {
        return await AppDataSource.transaction(async (manager) => {
            const achievement = await manager.findOneBy(Achievement, { achievement_key: achievementKey });
            if (!achievement) return;

            let ua = await manager.findOne(UserAchievement, {
                where: { user_id: userId, achievement_id: achievement.id }
            });

            if (!ua) {
                ua = manager.create(UserAchievement, { user_id: userId, achievement_id: achievement.id });
            }

            if (ua.is_completed) return;

            ua.current_progress += increment;
            if (ua.current_progress >= achievement.max_progress) {
                ua.is_completed = true;
                ua.completed_at = new Date();

                // Auto-award gems if configured
                if (achievement.reward_gems > 0) {
                    await this.addGems(userId, achievement.reward_gems, TransactionType.REWARD, `Achievement: ${achievement.name}`);
                }

                // Increment XP/Level logic
                if (achievement.reward_xp > 0) {
                    const profile = await manager.findOneBy(UserProfile, { user_id: userId });
                    if (profile) {
                        profile.experience_points += achievement.reward_xp;
                        // Simple level up logic: levels every 1000 XP
                        profile.level = Math.floor(profile.experience_points / 1000) + 1;
                        await manager.save(profile);
                    }
                }
            }

            await manager.save(ua);
        });
    }

    // ── Gem Purchases ─────────────────────────────────────────────
    static async processPurchase(userId: string, packageId: string, transactionId: string) {
        return await AppDataSource.transaction(async (manager) => {
            const pkg = await manager.findOneBy(GemPackage, { id: packageId });
            if (!pkg) throw new Error("Invalid gem package");

            const totalGems = pkg.gems_amount + pkg.bonus_gems;

            const purchase = manager.create(Purchase, {
                user_id: userId,
                gem_package_id: packageId,
                gems_amount: totalGems,
                price: pkg.price,
                currency: pkg.currency,
                transaction_id: transactionId,
                status: "completed"
            });
            await manager.save(purchase);

            await this.addGems(userId, totalGems, TransactionType.PURCHASE, `Purchase: ${pkg.name}`, purchase.id);

            return { gemsAdded: totalGems };
        });
    }
}
