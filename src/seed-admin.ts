import "reflect-metadata";
import { AppDataSource } from "./data-source.js";
import { User } from "./entities/User.js";
import bcrypt from "bcrypt";

async function seedAdmin() {
    try {
        await AppDataSource.initialize();
        console.log("📡 Connected to database for seeding...");

        const userRepository = AppDataSource.getRepository(User);
        
        const username = "ludo_admin";
        const email = "admin@dreamludo.com";
        const password = "B9qp63RLyLf70iEQw3";
        const fullName = "Local Administrator";

        const existingUser = await userRepository.findOneBy({ username });

        if (existingUser) {
            console.log(`⚠️ User '${username}' already exists. Updating to ensure Admin status...`);
            existingUser.isAdmin = true;
            await userRepository.save(existingUser);
        } else {
            console.log(`👤 Creating new admin user: ${username}`);
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const admin = userRepository.create({
                username,
                email,
                password: hashedPassword,
                fullName,
                isAdmin: true,
                isProfileCompleted: true,
                depositBal: 0,
                wonBal: 0,
                bonusBal: 0,
                gems: 0
            });

            await userRepository.save(admin);
            console.log("✅ Admin user created successfully!");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seedAdmin();
