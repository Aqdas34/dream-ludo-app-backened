import { Router } from "express";
import { AdminController } from "./adminController.js";

const router = Router();

router.get("/stats", AdminController.getStats);
router.get("/users", AdminController.getAllUsers);

export default router;
