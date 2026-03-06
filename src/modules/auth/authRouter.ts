import { Router } from "express";
import { AuthController } from "./authController.js";

const router = Router();

router.get("/get_user_login", AuthController.login);
router.post("/post_user_register", AuthController.register);
router.get("/get_app_details", AuthController.getAppDetails);
router.get("/get_profile", AuthController.getProfile);
router.post("/update_profile", AuthController.updateProfile);

export default router;
