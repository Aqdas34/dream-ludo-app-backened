import { Router } from "express";
import { AdminController2 } from "./adminController2.js";
const router = Router();
router.get("/stats", AdminController2.getStats);
export default router;
