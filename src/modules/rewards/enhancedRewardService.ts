import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { GemTransaction } from "../../entities/GemTransaction.js";
import { GemPackage } from "../../entities/GemPackage.js";
import { Purchase } from "../../entities/Purchase.js";
import { RewardHistory, RewardType } from "../../entities/RewardHistory.js";

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
            const user = await manager.findOneBy(User, { id: Number(userId) });
            if (!user) throw new Error("User not found");

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

            user.gems = (user.gems || 0) + totalGemsAdded;
            await manager.save(user);

            const history = manager.create(RewardHistory, {
                user: user,
                type: RewardType.PURCHASE,
                amount: totalGemsAdded,
                description: `Purchase: ${pkg.name}`
            });
            await manager.save(history);

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
}
