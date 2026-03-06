import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { RewardHistory, RewardType } from "../../entities/RewardHistory.js";

export class RewardService {

    // ── Update Rewards After Game ─────────────────────────────────
    static async updateGameRewards(userId: number, isWinner: boolean) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: userId });
            if (!user) throw new Error("User not found");

            const balanceReward = isWinner ? 100 : 20;
            const gemReward = isWinner ? 10 : 2; // Winners get 10 gems, participation 2

            user.bonusBal = Number(user.bonusBal) + balanceReward;
            user.gems = (user.gems || 0) + gemReward;
            user.totalGames += 1;
            if (isWinner) user.totalWins += 1;

            await manager.save(user);

            const history = new RewardHistory();
            history.user = user;
            history.amount = gemReward;
            history.type = isWinner ? RewardType.GAME_WIN : RewardType.GAME_PARTICIPATION;
            history.description = isWinner ? `Won match - +${gemReward} Gems` : `Match participation - +${gemReward} Gems`;
            await manager.save(history);

            // ── Check Achievements ──────────────────────────────────
            await this.checkAchievements(manager, user);

            return { gems: user.gems, bonusBal: user.bonusBal };
        });
    }

    private static async checkAchievements(manager: any, user: User) {
        // Milestone 1: First Win
        if (user.totalWins === 1) {
            user.gems += 20; // 20 diamonds for 1st win!
            await manager.save(user);
            await manager.save(RewardHistory, {
                user: user, amount: 20, type: RewardType.GAME_WIN,
                description: "Achievement Unlocked: Your First Victory! 🎉"
            });
        }

        // Milestone 2: 10 Games played
        if (user.totalGames === 10) {
            user.gems += 50;
            await manager.save(user);
            await manager.save(RewardHistory, {
                user: user, amount: 50, type: RewardType.GAME_PARTICIPATION,
                description: "Achievement: Ludo Veteran (10 Games) 🎮"
            });
        }
    }

    // ── Claim Daily Reward ────────────────────────────────────────
    static async claimDailyReward(userId: number) {
        return await AppDataSource.transaction(async (manager) => {
            const user = await manager.findOneBy(User, { id: userId });
            if (!user) throw new Error("User not found");

            const now = new Date();
            if (user.lastDailyClaim) {
                const lastClaim = new Date(user.lastDailyClaim);
                const lastClaimDay = lastClaim.toISOString().split('T')[0];
                const today = now.toISOString().split('T')[0];

                if (lastClaimDay === today) {
                    throw new Error("Already claimed today");
                }
            }

            const gemAmount = 10; // 10 Free Gems daily
            user.gems = (user.gems || 0) + gemAmount;
            user.lastDailyClaim = now;
            await manager.save(user);

            const history = new RewardHistory();
            history.user = user;
            history.amount = gemAmount;
            history.type = RewardType.DAILY_LOGIN;
            history.description = "Daily Login Reward - +10 Gems";
            await manager.save(history);

            return user.gems;
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
                const h1 = new RewardHistory();
                h1.user = referrer; h1.amount = 200; h1.type = RewardType.REFERRAL;
                await manager.save(h1);
            }

            if (newUser) {
                newUser.bonusBal = Number(newUser.bonusBal) + 200;
                await manager.save(newUser);
                const h2 = new RewardHistory();
                h2.user = newUser; h2.amount = 200; h2.type = RewardType.REFERRAL;
                await manager.save(h2);
            }
        });
    }
}
