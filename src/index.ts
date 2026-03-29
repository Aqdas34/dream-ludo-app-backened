import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { AppDataSource } from "./data-source.js";
import { setupSockets } from "./sockets/index.js";

import authRouter from "./modules/auth/authRouter.js";
import matchRouter from "./modules/match/matchRouter.js";
import rewardRouter from "./modules/rewards/rewardRouter.js";
import adminRouter from "./modules/admin/adminRouter.js";
import leaderboardRouter from "./modules/leaderboard/leaderboardRouter.js";

const app = express();
app.use(cors());
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use((req: any, res, next) => {
    console.log(`[${req.method}] ${req.path} - Content-Type: ${req.headers['content-type']}`);
    if (req.rawBody) {
        console.log(`📦 Raw Body: ${req.rawBody.substring(0, 100)}${req.rawBody.length > 100 ? '...' : ''}`);
    }
    req.body = req.body || {};
    next();
});

// Main API Routes
app.use("/api", authRouter);
app.use("/api", matchRouter);
app.use("/api", rewardRouter);
app.use("/api", leaderboardRouter);
app.use("/api/admin", adminRouter);

const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3005;

AppDataSource.initialize()
    .then(async () => {
        console.log("🚀 Database Initialized");

        setupSockets(io);

        httpServer.listen(Number(PORT), "0.0.0.0", () => {
            console.log(`📡 Server running on http://0.0.0.0:${PORT} [Ver: 2.1 - With Validation]`);
        });
    })
    .catch((error) => {
        console.log("❌ Error initializing database:", error);
    });

process.on('uncaughtException', (error) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🌊 UNHANDLED REJECTION:', reason);
});
