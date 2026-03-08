import { AppDataSource } from "../../data-source.js";
import { Notification } from "../../entities/Notification.js";
import { User } from "../../entities/User.js";
import { io } from "../../index.js";

export class NotificationService {
    static async sendGlobalBroadcast(title: string, message: string, type: string = "info") {
        try {
            // 1. Save to Database for persistence
            const notificationRepository = AppDataSource.getRepository(Notification);
            const notification = notificationRepository.create({
                title,
                message,
                type,
                user: null // Global
            });
            await notificationRepository.save(notification);

            // 2. Emit via WebSocket for real-time online users
            if (io) {
                io.emit("systemBroadcast", {
                    title,
                    message,
                    type,
                    id: notification.id,
                    timestamp: Date.now()
                });
            }

            // 3. Push Notification (Note: Native Push removed as per request. Long-polling/Socket used instead)
            console.log(`[Broadcast] Persistence saved and real-time socket emitted: ${title}`);

        } catch (error) {
            console.error("Error sending global broadcast:", error);
        }
    }

    static async sendToUser(userId: number, title: string, message: string, type: string = "info") {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOneBy({ id: userId });
            if (!user) return;

            const notificationRepository = AppDataSource.getRepository(Notification);
            const notification = notificationRepository.create({
                title,
                message,
                type,
                user
            });
            await notificationRepository.save(notification);

            // Real-time via socket (if user is connected, they should be in a room with their userId)
            if (io) {
                io.to(`user:${userId}`).emit("notification", {
                    title,
                    message,
                    type,
                    id: notification.id,
                    timestamp: Date.now()
                });
            }

            // FCM
            // if (user.fcmToken) { ... }
        } catch (error) {
            console.error(`Error sending notification to user ${userId}:`, error);
        }
    }
}
