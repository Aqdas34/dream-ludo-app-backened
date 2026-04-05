import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { UserProfile } from "../../entities/UserProfile.js";

export class ProfileService {
    /**
     * Ensures a UserProfile exists for the given user.
     * If not, creates one by syncing basic data from the User entity.
     */
    static async ensureProfile(userId: string): Promise<UserProfile> {
        const profileRepo = AppDataSource.getRepository(UserProfile);
        const userRepo = AppDataSource.getRepository(User);

        // 1. Check if profile exists
        let profile = await profileRepo.findOneBy({ user_id: userId });
        if (profile) return profile;

        // 2. Fetch User to get baseline data
        const user = await userRepo.findOneBy({ id: Number(userId) });
        if (!user) throw new Error(`Cannot create profile: User ${userId} not found`);

        // 3. Create new profile
        console.log(`👤 Creating missing UserProfile for user ${userId} (${user.username})`);
        profile = profileRepo.create({
            user_id: userId,
            display_name: user.fullName || user.username,
            gems_balance: user.gems || 0,
            experience_points: user.experience || 0,
            level: user.level || 1,
            total_games_played: user.totalGames || 0,
            total_wins: user.totalWins || 0
        });

        return await profileRepo.save(profile);
    }

    /**
     * Syncs gems from User to UserProfile or vice versa.
     * Useful for keeping legacy and new systems in sync.
     */
    static async syncGems(userId: string, newBalance: number) {
        const profileRepo = AppDataSource.getRepository(UserProfile);
        await profileRepo.update({ user_id: userId }, { gems_balance: newBalance });
    }
}
