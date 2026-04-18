import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { User } from "../../entities/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserOTP } from "../../entities/UserOTP.js";
import { EmailService } from "../../utils/emailService.js";

export class AuthController {
    static async login(req: Request, res: Response) {
        const { username, password } = req.query;

        if (!username || !password) {
            return res.status(400).json({ success: 0, msg: "Username and password required" });
        }

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: [{ username: username as string }, { email: username as string }],
            select: ["id", "username", "email", "password", "fullName", "mobile", "countryCode", "profileImg", "depositBal", "wonBal", "bonusBal", "isAdmin", "isProfileCompleted", "isVerified", "isBanned", "gems", "gender"]
        });

        if (!user) {
            return res.json({ success: 0, msg: "User not found" });
        }

        if (user.isBanned) {
            return res.json({ success: 0, msg: "Your account has been banned. Please contact support." });
        }

        if (!user.isVerified) {
            // Generate and Send a new OTP so they have it immediately upon redirect
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            try {
                const otpRepository = AppDataSource.getRepository(UserOTP);
                await otpRepository.delete({ email: user.email, type: 'registration' });
                await otpRepository.save(otpRepository.create({
                    email: user.email,
                    otp,
                    expiresAt,
                    type: 'registration'
                }));
                await EmailService.sendOTP(user.email, otp);
                console.log(`🔢 Fresh Login OTP sent to ${user.email}`);
            } catch (err) {
                console.error("❌ Failed to send login OTP:", err);
            }

            return res.json({ 
                success: 0, 
                msg: "Your email is not verified. A new code has been sent to your email.",
                needsVerification: true,
                result: [{
                    email: user.email,
                    username: user.username,
                    fullName: user.fullName
                }]
            });
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
                gems: 10,
                referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                referredBy: req.body.referer || null,
                isVerified: false
            });

            await userRepository.save(user);
            console.log(`✅ User created (Unverified): ${username}`);

            // ── Generate and Send OTP ──────────────────────────────────
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            const otpRepository = AppDataSource.getRepository(UserOTP);
            await otpRepository.delete({ email, type: 'registration' });
            
            await otpRepository.save(otpRepository.create({
                email,
                otp,
                expiresAt,
                type: 'registration'
            }));

            await EmailService.sendOTP(email, otp);
            console.log(`🔢 Registration OTP sent to ${email}`);

            // ── Handle Referral Reward ──────────────────────────────────
            if (req.body.referer) {
                const referrer = await userRepository.findOneBy({ referralCode: req.body.referer });
                if (referrer) {
                    try {
                        const { RewardService } = await import("../rewards/rewardService.js");
                        await RewardService.processReferral(referrer.id, user.id);
                        console.log(`🎁 Referral rewards processed for ${referrer.username} and ${user.username}`);
                    } catch (err) {
                        console.error("❌ Referral processing error:", err);
                    }
                }
            }

            // We return a simplified user object including email and username 
            // so the mobile app's UserResponse parser can recognize it.
            const userForResponse = {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName
            };

            return res.json({
                success: 1,
                msg: "Registration successful! Please verify the OTP sent to your email.",
                result: [userForResponse]
            });
        } catch (error: any) {
            console.error("🔥 Registration error:", error);
            return res.status(500).json({ success: 0, msg: "Internal server error during registration", error: error.message });
        }
    }

    static async verifyRegistrationOTP(req: Request, res: Response) {
        try {
            const { email, otp } = req.body;
            if (!email || !otp) return res.status(400).json({ success: 0, msg: "Email and OTP required" });

            const otpRepo = AppDataSource.getRepository(UserOTP);
            const validOTP = await otpRepo.findOne({ where: { email, otp, type: 'registration' } });

            if (!validOTP || new Date() > validOTP.expiresAt) {
                return res.status(400).json({ success: 0, msg: "Invalid or expired verification code" });
            }

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOneBy({ email });

            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            user.isVerified = true;
            await userRepo.save(user);
            await otpRepo.delete({ email, type: 'registration' });

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

            return res.json({
                success: 1,
                msg: "Email verified successfully",
                result: [{ ...user, token }]
            });
        } catch (e: any) {
            return res.status(500).json({ success: 0, msg: e.message });
        }
    }

    static async requestForgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ success: 0, msg: "Email required" });

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOneBy({ email });

            if (!user) return res.status(404).json({ success: 0, msg: "No account found with this email" });

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            const otpRepo = AppDataSource.getRepository(UserOTP);
            await otpRepo.delete({ email, type: 'reset' });
            await otpRepo.save(otpRepo.create({ email, otp, expiresAt, type: 'reset' }));

            await EmailService.sendOTP(email, otp);
            return res.json({ success: 1, msg: "Password reset code sent to your email" });
        } catch (e: any) {
            return res.status(500).json({ success: 0, msg: e.message });
        }
    }

    static async resetPassword(req: Request, res: Response) {
        try {
            const { email, otp, password } = req.body;
            if (!email || !otp || !password) return res.status(400).json({ success: 0, msg: "All fields required" });

            const otpRepo = AppDataSource.getRepository(UserOTP);
            const validOTP = await otpRepo.findOne({ where: { email, otp, type: 'reset' } });

            if (!validOTP || new Date() > validOTP.expiresAt) {
                return res.status(400).json({ success: 0, msg: "Invalid or expired reset code" });
            }

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOneBy({ email });
            if (!user) return res.status(404).json({ success: 0, msg: "User not found" });

            user.password = await bcrypt.hash(password, 10);
            await userRepo.save(user);
            await otpRepo.delete({ email, type: 'reset' });

            return res.json({ success: 1, msg: "Password reset successfully. You can now login." });
        } catch (e: any) {
            return res.status(500).json({ success: 0, msg: e.message });
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
                app_name: "XLudo",
                app_version: "1.0.0",
                app_url: "https://xludo.app",
                support_email: "support@xludo.app",
                whatsapp_no: "+966000000000",
                privacy_policy: "https://xludo.app/privacy",
                terms_condition: "https://xludo.app/terms",
                currency_code: "SAR",
                currency_sign: "SAR",
                country_code: "+966",
                maintenance_mode: 0,
                update_mandatory: 0
            }]
        });
    }
}
