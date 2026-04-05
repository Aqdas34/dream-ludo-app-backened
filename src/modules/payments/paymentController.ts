import { Request, Response } from "express";
import { AppDataSource } from "../../data-source.js";
import { Purchase } from "../../entities/Purchase.js";
import { User } from "../../entities/User.js";
import { GemPackage } from "../../entities/GemPackage.js";
import { PaylinkService } from "./paylinkService.js";
import { EnhancedRewardService } from "../rewards/enhancedRewardService.js";
import { ProfileService } from "../profile/profileService.js";
import { io } from "../../config/socket.js";

export class PaymentController {
    static async initiatePayment(req: Request, res: Response) {
        try {
            const { userId, packageId } = req.body;
            const userRepository = AppDataSource.getRepository(User);
            const packageRepository = AppDataSource.getRepository(GemPackage);
            const purchaseRepository = AppDataSource.getRepository(Purchase);

            const host = req.get("host");
            const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
            const baseUrl = `${protocol}://${host}`;

            const user = await userRepository.findOneBy({ id: Number(userId) });
            if (!user) return res.status(404).json({ success: false, message: "User not found" });

            const pkg = await packageRepository.findOneBy({ id: packageId });
            if (!pkg) return res.status(404).json({ success: false, message: "Gem package not found" });

            // CRITICAL FIX: Ensure UserProfile exists (resolves FK constraint violation)
            await ProfileService.ensureProfile(user.id.toString());

            // Create a local pending purchase
            const purchase = purchaseRepository.create({
                user_id: user.id.toString(),
                gem_package_id: packageId,
                gems_amount: pkg.gems_amount + pkg.bonus_gems,
                price: pkg.price,
                currency: pkg.currency || "SAR",
                status: "pending"
            });
            await purchaseRepository.save(purchase);

            // Notify Paylink
            const invoiceResponse = await PaylinkService.createInvoice({
                amount: pkg.price,
                clientMobile: user.mobile || "0500000000", // Fallback if missing
                clientName: user.fullName || user.username || "DreamLudo Player",
                orderNumber: purchase.id, // Use local purchase UUID as order number
                callBackUrl: `${baseUrl}/api/payments/success`,
                cancelUrl: `${baseUrl}/api/payments/cancel`,
                products: [{
                    title: pkg.name,
                    price: pkg.price,
                    qty: 1,
                    description: `${pkg.gems_amount} Gems + ${pkg.bonus_gems} Bonus`
                }]
            });

            if (invoiceResponse && (invoiceResponse.url || invoiceResponse.paymentUrl)) {
                console.log("🏦 --- Paylink Initial Invoice Response ---");
                console.log(JSON.stringify(invoiceResponse, null, 2));
                console.log("🏦 -----------------------------------------");

                // Capture ID from any of the possible bank fields
                purchase.invoice_id = (invoiceResponse.transactionId || invoiceResponse.transactionNo || invoiceResponse.invoiceId)?.toString();
                purchase.payment_url = invoiceResponse.url || invoiceResponse.paymentUrl;
                await purchaseRepository.save(purchase);

                return res.json({ 
                    success: true, 
                    paymentUrl: invoiceResponse.url, 
                    transactionId: purchase.id,
                    successUrl: `${baseUrl}/api/payments/success`,
                    cancelUrl: `${baseUrl}/api/payments/cancel`
                });
            }

            throw new Error("Invalid response from Paylink");
        } catch (error: any) {
            console.error("Payment initiation failed:", error.message);
            // Return specific message to help debugging
            const errorMsg = error.message.includes("Authentication Failed") 
                ? "Paylink Auth Failed: Check your PAYLINK_APP_ID and PAYLINK_SECRET_KEY in .env"
                : error.message;
                
            res.status(500).json({ 
                success: false, 
                message: errorMsg,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

  public static async handleWebhook(req: Request, res: Response) {
    try {
      console.log("📡 --- Paylink Webhook Payload Start ---");
      console.log(JSON.stringify(req.body, null, 2));
      console.log("📡 --- Payload End ---");

      // Paylink v2 uses merchantOrderNumber and transactionNo
      const transactionId = (req.body.transactionNo || req.body.transactionId) as string;
      const orderNumber = (req.body.merchantOrderNumber || req.body.orderNumber) as string;
      const orderStatus = req.body.orderStatus;

      if (orderStatus && orderStatus.toString().toLowerCase() === "paid") {
        await PaymentController.fulfillPurchase(orderNumber, transactionId);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("🔥 Webhook processing failed:", error.message);
      res.status(500).json({ success: false });
    }
  }

  private static async fulfillPurchase(orderNumber: string, transactionId: string) {
    try {
      const purchaseRepository = AppDataSource.getRepository(Purchase);
      const purchase = await purchaseRepository.findOne({
        where: { id: orderNumber, status: "pending" }
      });

      if (purchase) {
        console.log(`💎 Fulfilling Gem Order: ${orderNumber} for User: ${purchase.user_id}`);
        const result = await EnhancedRewardService.processPurchase(
          purchase.user_id,
          purchase.gem_package_id,
          transactionId || purchase.invoice_id
        );

        purchase.status = "completed";
        purchase.transaction_id = transactionId;
        await purchaseRepository.save(purchase);

        io.to(`user_${purchase.user_id}`).emit("balance_update", {
          gems: result.totalGems,
          message: "Payment successfully processed!"
        });
        return true;
      }
      return false;
    } catch (e: any) {
      console.error("💎 Fulfillment Error:", e.message);
      return false;
    }
  }

  static async checkStatus(req: Request, res: Response) {
    try {
            const { transactionId } = req.params;
            const purchaseRepository = AppDataSource.getRepository(Purchase);
            
            // Try lookup by UUID (our ID) OR invoice_id (Paylink ID)
            const purchase = await purchaseRepository.findOne({
              where: [
                { id: transactionId as string },
                { invoice_id: transactionId as string }
              ]
            });

            if (!purchase) return res.status(404).json({ success: false, message: "Transaction not found" });

            if (purchase.status === "completed") {
                return res.json({ success: true, status: "completed" });
            }

            // Manual check with Paylink if still pending
            if (purchase.invoice_id) {
                const paylinkStatus = await PaylinkService.getInvoiceStatus(purchase.invoice_id);
                
                // CHECK FOR ERRORS (e.g. BLOCKED, DECLINED)
                if (paylinkStatus.paymentErrors && paylinkStatus.paymentErrors.length > 0) {
                  const lastErr = paylinkStatus.paymentErrors[0];
                  console.warn(`❌ Bank reported error for ${transactionId}: ${lastErr.errorTitle}`);
                  return res.json({ 
                    success: true, 
                    status: "failed", 
                    message: lastErr.errorTitle || "Payment declined by bank" 
                  });
                }

                if (paylinkStatus.orderStatus && paylinkStatus.orderStatus.toString().toLowerCase() === "paid") {
                    // This could happen if webhook failed or was delayed
                    // We verify status is Paid before crediting
                    const result = await EnhancedRewardService.processPurchase(
                        purchase.user_id,
                        purchase.gem_package_id,
                        purchase.invoice_id
                    );
                    purchase.status = "completed";
                    purchase.transaction_id = purchase.invoice_id;
                    await purchaseRepository.save(purchase);
                    
                    return res.json({ success: true, status: "completed", gems: result.totalGems });
                }
                return res.json({ success: true, status: paylinkStatus.orderStatus.toLowerCase() });
            }

            res.json({ success: true, status: purchase.status });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    public static async handleSuccess(req: Request, res: Response) {
    // LOG EVERYTHING from Paylink for debugging
    console.log("🏦 --- Paylink Success Redirect Query Params ---");
    console.log(JSON.stringify(req.query, null, 2));
    console.log("🏦 --------------------------------------------");

    // Paylink can use multiple names for IDs, but orderNumber is OUR UUID and most reliable
    const orderNo = (req.query.orderNumber || req.query.orderID) as string;
    const txNo = (req.query.transactionNo || req.query.transactionId) as string;
    
    let finalTxId = txNo;
    let matchOrderNo = orderNo;

    console.log(`🏦 User landed on Success Page. Order: ${orderNo}, TX: ${txNo}`);

    // Try to verify status immediately
    if (orderNo || txNo) {
      try {
        // CRITICAL: Always try to find our local record first as it holds the verified invoice_id
        const purchaseRepo = AppDataSource.getRepository(Purchase);
        let p = null;
        
        if (orderNo) {
            p = await purchaseRepo.findOneBy({ id: orderNo });
        }
        
        if (!p && txNo) {
           // Fallback search by invoice_id if orderNumber is missing
           p = await purchaseRepo.findOneBy({ invoice_id: txNo });
        }

        if (p) {
            finalTxId = p.invoice_id; // Use the one we KNOW Paylink accepts
            matchOrderNo = p.id;
            
            const statusResponse = await PaylinkService.getInvoiceStatus(finalTxId);
            console.log(`🏦 Bank API Status Check [${finalTxId}]: ${statusResponse.orderStatus}`);
            
            if (statusResponse.orderStatus && statusResponse.orderStatus.toString().toLowerCase() === "paid") {
              await PaymentController.fulfillPurchase(matchOrderNo, finalTxId);
            } else {
              console.log(`⚠️ Bank still says "${statusResponse.orderStatus}". Spawning background retry...`);
              
              // BACKGROUND RETRY: Try 5 more times in background (every 3s)
              // We don't await this so the user gets their success page immediately
              (async () => {
                let attempts = 0;
                const maxAttempts = 5;
                const retryOrderNo = matchOrderNo;
                const retryTxId = finalTxId;

                while (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  attempts++;
                  console.log(`📡 [GHOST] Background Retry #${attempts} for ${retryOrderNo}...`);
                  
                  try {
                    const retryStatus = await PaylinkService.getInvoiceStatus(retryTxId);
                    if (retryStatus.orderStatus && retryStatus.orderStatus.toString().toLowerCase() === "paid") {
                      console.log(`🏁 [GHOST] Payment finally PAID for ${retryOrderNo}! Fulfilling...`);
                      await PaymentController.fulfillPurchase(retryOrderNo, retryTxId);
                      break;
                    }
                  } catch (e) {
                    console.error(`❌ [GHOST] Retry #${attempts} failed:`, e);
                  }
                }
              })();
            }
        } else {
            console.warn("⚠️ Could not find a matching local purchase record.");
        }
      } catch (e: any) {
        console.error("🔥 Instant Verification Failed:", e.message);
      }
    }

    const intentUrl = "intent://payment/success#Intent;scheme=xludo;package=com.dreamludo.app;end";
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Success</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px 20px; background: #0D0612; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #E91E63; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .success-icon { font-size: 64px; margin-bottom: 20px; }
            .btn { background: #E91E63; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold; margin-top: 20px; }
          </style>
          <script>
            let checkCount = 0;
            const maxChecks = 10; // Stop after 25 seconds
            
            function checkPaymentStatus() {
              if (checkCount >= maxChecks) {
                console.log("Max checks reached. Waiting for user.");
                return;
              }
              
              checkCount++;
              fetch('/api/payments/status/${orderNo || txNo}')
                .then(res => res.json())
                .then(data => {
                  if (data.status === 'completed') {
                    document.getElementById('status-text').innerHTML = "✅ Verified! Returning to game...";
                    setTimeout(() => {
                        window.location.href = "${intentUrl}";
                        setTimeout(() => { window.location.href = "xludo://payment/success"; }, 500);
                    }, 1000);
                  } else if (data.status === 'failed') {
                    document.getElementById('status-text').innerHTML = "❌ Payment Failed: " + (data.message || "Declined by bank");
                    document.getElementById('status-text').style.color = "#FF1744";
                    document.querySelecto                    // SAFE-ADD DEBUG BUTTON
                    const forceBtn = document.createElement('button');
                    forceBtn.id = "force-btn";
                    forceBtn.className = "btn";
                    forceBtn.style.cssText = "background: #fb8c00; margin-top: 10px; border: none; cursor: pointer; display: block; margin-left: auto; margin-right: auto;";
                    forceBtn.innerHTML = "🛠️ DEBUG: Force Gem Delivery";
                    document.body.appendChild(forceBtn);
                    
                    forceBtn.onclick = function() {
                      this.innerHTML = "Processing...";
                      this.disabled = true;
                      fetch(window.location.origin + '/api/payments/test-fulfill', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          orderNumber: '${matchOrderNo || orderNo}', 
                          transactionId: '${finalTxId || txNo}' 
                        })
                      })
                      .then(r => r.json().catch(() => ({ success: false, message: "Server Error" })))
                      .then(d => {
                        const statusEl = document.getElementById('status-text');
                        if (d.success) {
                          if (statusEl) {
                            statusEl.innerHTML = "✅ DEBUG SUCCESS! Returning to game...";
                            statusEl.style.color = "#4CAF50";
                          }
                          this.style.display = "none";
                          setTimeout(() => {
                              window.location.href = "${intentUrl}";
                              setTimeout(() => { window.location.href = "xludo://payment/success"; }, 500);
                          }, 1000);
                        } else {
                          this.innerHTML = "❌ Error: " + (d.message || "Failed");
                          this.disabled = false;
                        }
                      })
                      .catch(e => {
                        this.innerHTML = "❌ Network Error";
                        this.disabled = false;
                      });
                    };
                  } else {
                    setTimeout(checkPaymentStatus, 2500);
                  }
                })
                .catch(err => {
                  console.error("Status check failed:", err);
                  setTimeout(checkPaymentStatus, 3000);
                });
            }

            // Start polling if still pending
            setTimeout(checkPaymentStatus, 2000);
            
            // Initial redirect attempt after short delay
            setTimeout(() => {
              window.location.href = "${intentUrl}";
              setTimeout(() => { window.location.href = "xludo://payment/success"; }, 500);
            }, 3500);
          </script>
        </head>
        <body>
          <div class="success-icon">✅</div>
          <h1>💰 Payment Success!</h1>
          <div class="loader"></div>
          <p id="status-text">Verifying your gems with the bank...</p>
          <p style="font-size: 10px; color: #555;">Ref: ${orderNo || txNo || 'Processing...'}</p>
          <a href="${intentUrl}" class="btn">Return to XLudo Game</a>
        </body>
      </html>
    `);
  }

    public static async handleCancel(req: Request, res: Response) {
        const intentUrl = "intent://payment/cancel#Intent;scheme=xludo;package=com.dreamludo.app;end";
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Payment Cancelled</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: sans-serif; text-align: center; padding: 50px 20px; background: #0D0612; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .btn { background: #555; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold; margin-top: 20px; }
              </style>
              <script>
                setTimeout(() => {
                  window.location.href = "${intentUrl}";
                  // Fallback
                  setTimeout(() => { window.location.href = "xludo://payment/cancel"; }, 500);
                }, 1000);
              </script>
            </head>
            <body>
              <div class="cancel-icon" style="font-size: 64px; margin-bottom: 20px;">❌</div>
              <h1>Payment Cancelled</h1>
              <p>The transaction was not completed. Returning to store...</p>
              <a href="${intentUrl}" class="btn">Return to Store</a>
            </body>
          </html>
        `);
    }

    public static async testFulfill(req: Request, res: Response) {
        try {
            const { orderNumber, transactionId } = req.body;
            console.log(`🛠️ [DEBUG] Forcing fulfillment for Order: ${orderNumber}, TX: ${transactionId}`);
            
            const success = await PaymentController.fulfillPurchase(orderNumber, transactionId);
            
            if (success) {
                return res.json({ success: true, message: "Debug fulfillment successful!" });
            } else {
                return res.status(400).json({ success: false, message: "Debug fulfillment failed. Check logs." });
            }
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    }
}
