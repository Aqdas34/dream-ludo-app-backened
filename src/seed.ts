import { AppDataSource } from "./data-source.js";
import { Achievement } from "./entities/Achievement.js";
import { GemPackage } from "./entities/GemPackage.js";
import { User } from "./entities/User.js";
import bcrypt from "bcrypt";

async function seed() {
    try {
        await AppDataSource.initialize();
        console.log("🌱 Starting Database Seeding...");

        const achievementRepo = AppDataSource.getRepository(Achievement);
        const packageRepo = AppDataSource.getRepository(GemPackage);
        const userRepo = AppDataSource.getRepository(User);

        // ── Seed Achievements ────────────────────────────────────────
        const achievements = [
            {
                achievement_key: "first_win",
                name: "First Victory",
                description: "Win your first game of Ludo",
                reward_gems: 100,
                reward_xp: 50,
                max_progress: 1,
                category: "gameplay"
            },
            {
                achievement_key: "capture_10",
                name: "Piece Hunter",
                description: "Capture 10 opponent pieces",
                reward_gems: 250,
                reward_xp: 150,
                max_progress: 10,
                category: "gameplay"
            },
            {
                achievement_key: "login_7_days",
                name: "Dedicated Player",
                description: "Login for 7 consecutive days",
                reward_gems: 500,
                reward_xp: 300,
                max_progress: 7,
                category: "social"
            }
        ];

        for (const a of achievements) {
            const existing = await achievementRepo.findOneBy({ achievement_key: a.achievement_key });
            if (!existing) {
                await achievementRepo.save(achievementRepo.create(a));
                console.log(`✅ Achievement created: ${a.name}`);
            }
        }

        // ── Seed Gem Packages ───────────────────────────────────────
        const packages = [
            {
                id: "small",
                name: "Handful of Gems",
                gems_amount: 100,
                bonus_gems: 0,
                price: 0.99,
                is_popular: false,
                sort_order: 1
            },
            {
                id: "medium",
                name: "Bag of Gems",
                gems_amount: 500,
                bonus_gems: 50,
                price: 4.99,
                is_popular: true,
                sort_order: 2
            },
            {
                id: "large",
                name: "Chest of Gems",
                gems_amount: 1200,
                bonus_gems: 200,
                price: 9.99,
                is_popular: false,
                sort_order: 3
            }
        ];

        for (const p of packages) {
            const existing = await packageRepo.findOneBy({ id: p.id });
            if (!existing) {
                await packageRepo.save(packageRepo.create(p));
                console.log(`✅ Package created: ${p.name}`);
            }
        }

        // ── Seed Test User ──────────────────────────────────────────
        const testUsername = "testuser";
        const existingUser = await userRepo.findOneBy({ username: testUsername });
        if (!existingUser) {
            const hashedPassword = await bcrypt.hash("password123", 10);
            const testUser = userRepo.create({
                username: testUsername,
                email: "test@example.com",
                password: hashedPassword,
                fullName: "Test User",
                mobile: "1234567890",
                countryCode: "+1",
                referralCode: "TEST123"
            });
            await userRepo.save(testUser);
            console.log(`✅ Test User created: ${testUsername} (password123)`);
        }

        console.log("✨ Seeding Complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seed();
