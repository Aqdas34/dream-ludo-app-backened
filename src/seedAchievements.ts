import { AppDataSource } from "./data-source.js";
import { Achievement } from "./entities/Achievement.js";
import { User } from "./entities/User.js";
import { UserAchievement } from "./entities/UserAchievement.js";

async function seedAchievements() {
    await AppDataSource.initialize();

    const achievementRepo = AppDataSource.getRepository(Achievement);
    const uaRepo = AppDataSource.getRepository(UserAchievement);
    const userRepo = AppDataSource.getRepository(User);

    const achievements = [
        {
            achievement_key: "welcome",
            name: "Welcome to Dream Ludo",
            description: "Thanks for joining us! Here's a small gift to start.",
            category: "special",
            reward_gems: 50,
            reward_xp: 100,
            max_progress: 1,
            is_hidden: false
        },
        {
            achievement_key: "first_game",
            name: "First Steps",
            description: "Play your first game of Ludo.",
            category: "gameplay",
            reward_gems: 10,
            reward_xp: 200,
            max_progress: 1,
            is_hidden: false
        },
        {
            achievement_key: "games_10",
            name: "Rookie Player",
            description: "Play 10 games.",
            category: "gameplay",
            reward_gems: 100,
            reward_xp: 500,
            max_progress: 10,
            is_hidden: false
        },
        {
            achievement_key: "wins_5",
            name: "Champion in Training",
            description: "Win 5 games.",
            category: "gameplay",
            reward_gems: 200,
            reward_xp: 1000,
            max_progress: 5,
            is_hidden: false
        }
    ];

    console.log("Seeding achievements...");
    for (const ach of achievements) {
        let existing = await achievementRepo.findOneBy({ achievement_key: ach.achievement_key });
        if (!existing) {
            existing = achievementRepo.create(ach);
            await achievementRepo.save(existing);
            console.log(`Created achievement: ${ach.name}`);
        } else {
            console.log(`Achievement already exists: ${ach.name}`);
        }
    }

    // Now, let's make the "welcome" achievement completed for everyone
    console.log("Assigning 'welcome' achievement to users...");
    const welcomeAch = await achievementRepo.findOneBy({ achievement_key: "welcome" });
    if (welcomeAch) {
        const users = await userRepo.find();
        for (const user of users) {
            const userId = user.id.toString();
            let ua = await uaRepo.findOneBy({ user_id: userId, achievement_key: "welcome" });
            if (!ua) {
                ua = uaRepo.create({
                    user_id: userId,
                    achievement_key: "welcome",
                    achievement: welcomeAch,
                    current_progress: 1,
                    is_completed: true,
                    claimed_reward: false
                });
                await uaRepo.save(ua);
                console.log(`Assigned 'welcome' to user ${user.username}`);
            }
        }
    }

    console.log("Seeding complete!");
    process.exit(0);
}

seedAchievements().catch(err => {
    console.error("Error seeding:", err);
    process.exit(1);
});
