import { DataSource } from "typeorm";
import { User } from "./entities/User.js";
import { RewardHistory } from "./entities/RewardHistory.js";
import { Match } from "./entities/Match.js";
import { UserProfile } from "./entities/UserProfile.js";
import { GemTransaction } from "./entities/GemTransaction.js";
import { Purchase } from "./entities/Purchase.js";
import { DailyReward } from "./entities/DailyReward.js";
import { Achievement } from "./entities/Achievement.js";
import { UserAchievement } from "./entities/UserAchievement.js";
import { GameReward } from "./entities/GameReward.js";
import { GemPackage } from "./entities/GemPackage.js";
import { GameHistory } from "./entities/GameHistory.js";
import { Notification } from "./entities/Notification.js";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

export const AppDataSource = new DataSource({

    type: "postgres",
    ...(isProduction
        ? {
            url: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        }
        : {
            host: process.env.DB_HOST || "localhost",
            port: parseInt(process.env.DB_PORT || "5432"),
            username: process.env.DB_USER || "postgres",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "dream_ludo"
        }),

    synchronize: true,
    logging: false,
    // host: process.env.DB_HOST || "localhost",
    // port: parseInt(process.env.DB_PORT || "5432"),
    // username: process.env.DB_USER || "postgres",
    // password: process.env.DB_PASSWORD || "password",
    // database: process.env.DB_NAME || "dream_ludo",
    // synchronize: true, // Auto-create tables (use migrations in production)
    // logging: false,

    entities: [
        User,
        RewardHistory,
        Match,
        UserProfile,
        GemTransaction,
        Purchase,
        DailyReward,
        Achievement,
        UserAchievement,
        GameReward,
        GemPackage,
        GameHistory,
        Notification
    ],
    migrations: [],
    subscribers: [],
    extra: {
        max: 20, // max connections in pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    }
});
