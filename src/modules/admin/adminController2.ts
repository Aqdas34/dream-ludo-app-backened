import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import { Match } from "../../entities/Match.js";
import { RewardHistory } from "../../entities/RewardHistory.js";
import { redis } from "../../config/redis.js";
export class AdminController2 {
    static async getStats(req: Request, res: Response) {
        res.json({ ok: true });
    }
}
