import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source.js";
import { User } from "../entities/User.js";

export const socketAuth = async (socket: any, next: (err?: Error) => void) => {
    try {
        const rawToken = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        if (!rawToken) return next(); // Allow guest for now if no token

        const token = String(rawToken).startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: decoded.id });
        if (user) {
            socket.user = user;
            socket.userId = user.id.toString();
        }
        return next();
    } catch (e) {
        console.error("Socket authentication error:", e);
        return next(); // Still allow guest if token is invalid
    }
};

export const authMiddleware = async (req: any, res: any, next: () => void) => {
    try {
        const rawToken = req.headers['authorization'] || req.query.token;
        if (!rawToken) return next();

        const token = String(rawToken).startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: decoded.id });
        if (user) {
            req.user = user;
            req.userId = user.id.toString();
        }
        return next();
    } catch (e) {
        return next();
    }
};

export const adminAuthMiddleware = async (req: any, res: any, next: () => void) => {
    try {
        const rawToken = req.headers['authorization'];
        if (!rawToken) {
            return res.status(401).json({ success: 0, msg: "Admin token required" });
        }

        const token = String(rawToken).startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: decoded.id });

        if (!user) {
            return res.status(401).json({ success: 0, msg: "Invalid token user" });
        }

        if (!user.isAdmin) {
            return res.status(403).json({ success: 0, msg: "Admin access only" });
        }

        req.user = user;
        req.userId = user.id.toString();
        return next();
    } catch (e) {
        return res.status(401).json({ success: 0, msg: "Invalid or expired admin token" });
    }
};
