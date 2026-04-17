import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Service to handle sending emails via SMTP (Gmail)
 */
export class EmailService {
    private static transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_TLS === "True" ? false : true, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    /**
     * Sends a 6-digit OTP to the specified email address
     */
    static async sendOTP(to: string, otp: string) {
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Dream Ludo Support'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to,
            subject: "Your Admin Password Security Code",
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">

                        <p style="color: #64748b; margin-top: 5px;">Admin Control Center</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; border-radius: 10px; color: #ffffff; text-align: center; margin-bottom: 30px;">
                        <p style="margin: 0 0 10px 0; font-size: 16px; opacity: 0.9;">Your Verification Code</p>
                        <h2 style="margin: 0; font-size: 42px; letter-spacing: 5px; font-weight: 800;">${otp}</h2>
                    </div>
                    
                    <div style="padding: 0 20px;">
                        <p style="color: #1e293b; font-size: 16px; line-height: 24px;">
                            Hello Administrator,
                        </p>
                        <p style="color: #475569; font-size: 14px; line-height: 22px;">
                            We received a request to access your administrative account. Please use the verification code above to continue your security process.
                        </p>
                        <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin-top: 20px;">
                            <p style="color: #9a3412; font-size: 13px; margin: 0;">
                                For security reasons, this code will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.
                            </p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                            &copy; . All rights reserved.<br>
                            This is an automated security notification.
                        </p>
                    </div>
                </div>
            `,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log("📧 Email sent: %s", info.messageId);
            return true;
        } catch (error) {
            console.error("❌ Email Delivery Error:", error);
            throw new Error("Failed to deliver security email. Please check your SMTP settings.");
        }
    }
}
