import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export class AuthController {
    static async login(req: Request, res: Response) {
        const { username, password } = req.query;

        if (!username || !password) {
            return res.status(400).json({ success: 0, msg: "Username and password required" });
        }

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: [{ username: username as string }, { email: username as string }],
            select: ["id", "username", "email", "password", "fullName", "mobile", "depositBal", "wonBal", "bonusBal", "isAdmin", "isProfileCompleted", "gems", "gender"]
        });

        if (!user) {
            return res.json({ success: 0, msg: "User not found" });
        }

        const isPasswordValid = await bcrypt.compare(password as string, user.password);
        if (!isPasswordValid) {
            return res.json({ success: 0, msg: "Invalid password" });
        }

        // Generate JWT
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

        return res.json({
            success: 1,
            msg: "Login successful",
            result: [{
                ...user,
                token
            }]
        });
    }

    static async register(req: Request, res: Response) {
        try {
            console.log("📝 Registration attempt:", req.body);
            const { full_name, username, email, mobile, password, country_code, gender } = req.body;

            if (!full_name || !username || !email || !password) {
                const missing = [];
                if (!full_name) missing.push("full_name");
                if (!username) missing.push("username");
                if (!email) missing.push("email");
                if (!password) missing.push("password");
                console.log("❌ Registration failed: Missing fields", missing);
                return res.status(400).json({ success: 0, msg: `Required fields missing: ${missing.join(", ")}` });
            }

            const userRepository = AppDataSource.getRepository(User);

            // Check if user exists
            const existing = await userRepository.findOne({
                where: [{ username }, { email }]
            });

            if (existing) {
                console.log(`❌ Registration failed: User exists (User: ${username}, Email: ${email})`);
                return res.json({ success: 0, msg: "User already exists with this username or email" });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const user = userRepository.create({
                fullName: full_name,
                username,
                email,
                mobile,
                countryCode: country_code,
                password: hashedPassword,
                isProfileCompleted: true,
                gender: gender || null,
                gems: 10, // Give 10 gems as a bonus for joining!
                referralCode: Math.random().toString(36).substring(7).toUpperCase(),
                referredBy: req.body.referer || null
            });

            await userRepository.save(user);
            console.log(`✅ Registration successful: ${username}`);

            // Generate JWT
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

            return res.json({
                success: 1,
                msg: "Registration successful",
                result: [{
                    ...user,
                    token
                }]
            });
        } catch (error: any) {
            console.error("🔥 Registration error:", error);
            return res.status(500).json({ success: 0, msg: "Internal server error during registration", error: error.message });
        }
    }

    static async getProfile(req: Request, res: Response) {
        try {
            const userId = req.query.userId || (req as any).user?.id;
            if (!userId) return res.status(400).json({ success: 0, msg: "User ID missing" });

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOne({ where: { id: Number(userId) } });

            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            return res.json({ success: 1, result: [user] });
        } catch (e: any) {
            return res.status(500).json({ success: 0, msg: e.message });
        }
    }

    static async updateProfile(req: Request, res: Response) {
        try {
            const userId = req.body.userId || (req as any).user?.id;
            if (!userId) return res.status(400).json({ success: 0, msg: "User ID missing" });

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOne({ where: { id: Number(userId) } });

            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            // Allow updates to fullName, mobile, gender
            if (req.body.full_name) user.fullName = req.body.full_name;
            if (req.body.mobile) user.mobile = req.body.mobile;
            if (req.body.gender) user.gender = req.body.gender;

            await userRepo.save(user);
            return res.json({ success: 1, msg: "Profile updated", result: [user] });
        } catch (e: any) {
            return res.status(500).json({ success: 0, msg: e.message });
        }
    }

    static async getAppDetails(req: Request, res: Response) {
        return res.json({
            success: 1,
            msg: "App details fetched",
            result: [{
                app_name: "Dream Ludo",
                app_version: "1.0.0",
                app_url: "https://dreamludo.app",
                support_email: "support@dreamludo.app",
                whatsapp_no: "+910000000000",
                privacy_policy: "https://dreamludo.app/privacy",
                terms_condition: "https://dreamludo.app/terms",
                maintenance_mode: 0,
                update_mandatory: 0
            }]
        });
    }
}
