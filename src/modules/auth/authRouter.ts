import { Router } from "express";
import { AuthController } from "./authController.js";
import { authLimiter, strictSecurityLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// Sensitive Authentication Endpoints
router.get("/get_user_login", authLimiter, AuthController.login);
router.post("/post_user_register", strictSecurityLimiter, AuthController.register);
router.post("/register/verify", strictSecurityLimiter, AuthController.verifyRegistrationOTP);
router.post("/password/forgot", strictSecurityLimiter, AuthController.requestForgotPassword);
router.post("/password/reset", strictSecurityLimiter, AuthController.resetPassword);

// General User Endpoints
router.get("/get_app_details", AuthController.getAppDetails);
router.get("/get_profile", AuthController.getProfile);
router.post("/update_profile", AuthController.updateProfile);

export default router;
