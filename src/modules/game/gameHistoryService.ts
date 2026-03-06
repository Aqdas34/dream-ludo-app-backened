import { AppDataSource } from "../../data-source.js";
import { GameHistory, GameResultStatus } from "../../entities/GameHistory.js";
import { RoomState } from "./LudoGame.js";

export class GameHistoryService {
    static async saveGameRecord(room: RoomState, userId: string, status: GameResultStatus, gemsAwarded: number = 0) {
        try {
            const historyRepo = AppDataSource.getRepository(GameHistory);

            const record = historyRepo.create({
                roomId: room.roomId,
                userId: userId,
                playersJson: JSON.stringify(room.players.map(p => ({
                    userId: p.userId,
                    username: p.username,
                    color: p.color
                }))),
                winnerId: room.winner,
                winnerName: room.players.find(p => p.userId === room.winner)?.username || "No winner",
                status: status,
                gemsAwarded: gemsAwarded,
                createdAt: new Date()
            });

            await historyRepo.save(record);
            console.log(`📝 Game history saved for user ${userId} (Room: ${room.roomId})`);
        } catch (error) {
            console.error("❌ Failed to save game history:", error);
        }
    }

    static async getUserHistory(userId: string) {
        const historyRepo = AppDataSource.getRepository(GameHistory);
        return await historyRepo.find({
            where: { userId: userId },
            order: { createdAt: "DESC" },
            take: 20
        });
    }
}
