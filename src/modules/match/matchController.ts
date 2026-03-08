import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { Match } from "../../entities/Match.js";

import { GameHistoryService } from "../game/gameHistoryService.js";
import { Notification } from "../../entities/Notification.js";
import { IsNull } from "typeorm";

export class MatchController {
    static async getUpcoming(req: Request, res: Response) {
        const matchRepository = AppDataSource.getRepository(Match);
        const matches = await matchRepository.find({
            where: { resultStatus: "pending" },
            order: { createdAt: "DESC" }
        });

        return res.json({
            success: 1,
            result: matches
        });
    }

    static async getHistory(req: Request, res: Response) {
        const userId = (req.headers['user-id'] || req.query.user_id) as string;
        if (!userId) return res.status(401).json({ success: 0, msg: "Unauthorized" });

        try {
            const result = await GameHistoryService.getUserHistory(userId);
            // Parse playersJson into objects for the frontend
            const formatted = result.map(record => ({
                ...record,
                players: JSON.parse(record.playersJson)
            }));

            return res.json({
                success: 1,
                result: formatted
            });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed" });
        }
    }

    static async getOngoing(req: Request, res: Response) {
        const matchRepository = AppDataSource.getRepository(Match);
        const matches = await matchRepository.find({
            where: { resultStatus: "ongoing" },
            order: { createdAt: "DESC" }
        });

        return res.json({
            success: 1,
            result: matches
        });
    }

    static async getCompleted(req: Request, res: Response) {
        const matchRepository = AppDataSource.getRepository(Match);
        const matches = await matchRepository.find({
            where: { resultStatus: "completed" },
            order: { createdAt: "DESC" }
        });

        return res.json({
            success: 1,
            result: matches
        });
    }

    static async joinMatch(req: Request, res: Response) {
        const { match_id, parti1 } = req.body;
        const matchRepository = AppDataSource.getRepository(Match);
        const match = await matchRepository.findOneBy({ id: Number(match_id) });

        if (!match) return res.json({ success: 0, msg: "Match not found" });
        if (match.tableJoined >= match.tableSize) return res.json({ success: 0, msg: "Table full" });

        match.tableJoined += 1;
        if (!match.parti1Id) {
            match.parti1Id = parti1;
        } else {
            match.parti2Id = parti1;
        }

        await matchRepository.save(match);
        return res.json({ success: 1, msg: "Joined successfully", result: [match] });
    }

    static async leaveMatch(req: Request, res: Response) {
        const { match_id, parti1 } = req.body;
        const matchRepository = AppDataSource.getRepository(Match);
        const match = await matchRepository.findOneBy({ id: Number(match_id) });

        if (!match) return res.json({ success: 0, msg: "Match not found" });

        match.tableJoined -= 1;
        if (match.parti1Id === parti1) match.parti1Id = "";
        else if (match.parti2Id === parti1) match.parti2Id = "";

        await matchRepository.save(match);
        return res.json({ success: 1, msg: "Left successfully", result: [match] });
    }

    static async submitResult(req: Request, res: Response) {
        const { match_id, user_id, parti1_status } = req.body;
        const matchRepository = AppDataSource.getRepository(Match);
        const match = await matchRepository.findOneBy({ id: Number(match_id) });

        if (!match) return res.json({ success: 0, msg: "Match not found" });

        match.resultStatus = "completed";
        match.winnerName = parti1_status === "win" ? "Winner" : "Opponent";

        await matchRepository.save(match);
        return res.json({ success: 1, msg: "Result submitted", result: [match] });
    }

    static async createTestMatches(req: Request, res: Response) {
        const matchRepository = AppDataSource.getRepository(Match);

        const testMatch = matchRepository.create({
            matchFee: 10,
            prize: 18,
            tableSize: 2,
            type: 1,
            startTime: "20:00 PM",
            resultStatus: "pending",
            tableJoined: 1,
            parti1Id: "1",
            parti1Name: "Player 1"
        });

        await matchRepository.save(testMatch);
        return res.json({ success: 1, msg: "Test matches created" });
    }

    static async getNotifications(req: Request, res: Response) {
        try {
            const notificationRepository = AppDataSource.getRepository(Notification);
            const notifications = await notificationRepository.find({
                where: { user: IsNull() },
                order: { createdAt: "DESC" },
                take: 20
            });
            return res.json({ success: 1, result: notifications });
        } catch (error) {
            return res.status(500).json({ success: 0, msg: "Failed" });
        }
    }
}
