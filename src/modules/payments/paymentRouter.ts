import { Router } from "express";
import { PaymentController } from "./paymentController.js";

const router = Router();

// Initiation endpoint (requires auth ideally but using plain for now)
router.post("/initiate", PaymentController.initiatePayment);

// Webhook endpoint (public for Paylink)
router.post("/test-fulfill", PaymentController.testFulfill);
router.post("/webhook", PaymentController.handleWebhook);

// Redirect Pages for WebView (Safe-Passage Bridge)
router.get("/success", PaymentController.handleSuccess);
router.get("/cancel", PaymentController.handleCancel);

// Manual status verification
router.get("/status/:transactionId", PaymentController.checkStatus);

export default router;
