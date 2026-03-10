import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { RewardHistory, RewardType } from "../../entities/RewardHistory.js";

export class RewardService {
    // ── Unified Reward Utility ────────────────────────────────────
    static async addReward(manager: any, user: User, amount: number, type: RewardType, description: string) {
        user.gems = (user.gems || 0) + amount;
        await manager.save(user);

        const history = new RewardHistory();
        history.user = user;
        history.amount = amount;
        history.type = type;
        history.description = description;
        await manager.save(history);
    }

    // ── Update Rewards After Game ─────────────────────────────────
    static async updateGameRewards(userId: number, isWinner: boolean) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: userId });
            if (!user) throw new Error("User not found");

            const balanceReward = isWinner ? 100 : 20;
            const gemReward = isWinner ? 10 : 2;
            const xpReward = isWinner ? 200 : 50;

            user.bonusBal = Number(user.bonusBal) + balanceReward;
            user.totalGames += 1;
            if (isWinner) user.totalWins += 1;

            // Level / XP logic
            user.experience += xpReward;
            user.level = Math.floor(user.experience / 1000) + 1;

            await manager.save(user);

            // Add gems and audit history
            await this.addReward(manager, user, gemReward,
                isWinner ? RewardType.GAME_WIN : RewardType.GAME_PARTICIPATION,
                isWinner ? `Game Victory - Level ${user.level}` : `Participation - Level ${user.level}`
            );

            // Milestone: First Win
            if (user.totalWins === 1) {
                await this.addReward(manager, user, 50, RewardType.GAME_WIN, "Achievement: First Victory! 🏆");
            }

            return { gems: user.gems, bonusBal: user.bonusBal, level: user.level, experience: user.experience };
        });
    }

    // ── Claim Daily Reward (With Streak) ─────────────────────────
    static async claimDailyReward(userId: number) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: userId });
            if (!user) throw new Error("User not found");

            const now = new Date();
            const today = now.toISOString().split('T')[0];

            if (user.lastDailyClaim) {
                const lastClaim = new Date(user.lastDailyClaim);
                const lastClaimDay = lastClaim.toISOString().split('T')[0];
                if (lastClaimDay === today) {
                    throw new Error("Already claimed today");
                }

                // Check streak continuity (yesterday)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayDay = yesterday.toISOString().split('T')[0];

                if (lastClaimDay === yesterdayDay) {
                    user.streakDays += 1;
                } else {
                    user.streakDays = 1;
                }
            } else {
                user.streakDays = 1;
            }

            // Streak Multiplier: Set to static 1 gem as requested
            const totalGems = 1;

            user.lastDailyClaim = now;
            await manager.save(user);

            await this.addReward(manager, user, totalGems, RewardType.DAILY_LOGIN,
                `Daily Login (Day ${user.streakDays})`
            );

            return { gems: user.gems, streak: user.streakDays, awarded: totalGems };
        });
    }

    // ── Referral Reward ──────────────────────────────────────────
    static async processReferral(referringUserId: number, newUserId: number) {
        return await AppDataSource.transaction(async (manager) => {
            const referrer = await manager.findOneBy(User, { id: referringUserId });
            const newUser = await manager.findOneBy(User, { id: newUserId });

            if (referrer) {
                referrer.bonusBal = Number(referrer.bonusBal) + 200;
                await manager.save(referrer);
                await this.addReward(manager, referrer, 5, RewardType.REFERRAL, "Referral Bonus: Invited Friend");
            }

            if (newUser) {
                newUser.bonusBal = Number(newUser.bonusBal) + 200;
                await manager.save(newUser);
                await this.addReward(manager, newUser, 5, RewardType.REFERRAL, "Referral Bonus: Joined via Code");
            }
        });
    }
}
