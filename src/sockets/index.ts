import { Server } from "socket.io";
import { socketAuth } from "../middleware/auth.js";
import { setupGameHandlers } from "./gameHandler.js";
import { connectRedis } from "../config/redis.js";

export const setupSockets = async (io: Server) => {
    await connectRedis();

    io.use(socketAuth);

    io.on("connection", (socket) => {
        const username = (socket as any).user?.username || `Guest_${socket.id.substring(0, 5)}`;
        console.log(`🔌 User connected: ${username}`);

        setupGameHandlers(io, socket);

        socket.on("disconnect", () => {
            console.log(`❌ User disconnected: ${username}`);
        });
    });
};
