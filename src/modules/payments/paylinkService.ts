import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_BASE = process.env.PAYLINK_API_BASE || "https://restpilot.paylink.sa";
const APP_ID = process.env.PAYLINK_APP_ID;
const SECRET_KEY = process.env.PAYLINK_SECRET_KEY;

export interface PaylinkProduct {
    title: string;
    price: number;
    qty: number;
    description?: string;
}

export interface PaylinkInvoiceRequest {
    amount: number;
    clientMobile: string;
    clientName: string;
    orderNumber: string;
    clientEmail?: string;
    products?: PaylinkProduct[];
    callBackUrl: string;
    cancelUrl: string;
}

export class PaylinkService {
    private static token: string | null = null;
    private static tokenExpiry: number | null = null;

    private static async getAuthToken(): Promise<string> {
        // Simple caching logic
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.token;
        }

        try {
            const response = await axios.post(`${API_BASE}/api/auth`, {
                apiId: APP_ID,
                secretKey: SECRET_KEY,
                persistToken: "false" // String as per documentation example
            }, {
                headers: {
                    "accept": "application/json",
                    "Content-Type": "application/json"
                }
            });

            if (response.data && response.data.id_token) {
                this.token = response.data.id_token;
                // Tokens usually last 30 min, we'll cache for 25
                this.tokenExpiry = Date.now() + 25 * 60 * 1000;
                return this.token!;
            }
            throw new Error("Failed to get Paylink Auth Token");
        } catch (error: any) {
            console.error("Paylink Auth Error:", error.response?.data || error.message);
            throw new Error("Paylink Authentication Failed");
        }
    }

    static async createInvoice(data: PaylinkInvoiceRequest) {
        const token = await this.getAuthToken();

        try {
            const response = await axios.post(`${API_BASE}/api/addInvoice`, data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "accept": "application/json",
                    "Content-Type": "application/json"
                }
            });

            return response.data; // contains url, transactionId
        } catch (error: any) {
            const paylinkError = error.response?.data;
            console.error("Paylink Add Invoice Error:", paylinkError || error.message);
            
            // Extract the specific Arabic/English message from Paylink if it exists
            const detail = paylinkError?.detail || paylinkError?.title || "Failed to create Paylink invoice";
            throw new Error(detail);
        }
    }

    static async getInvoiceStatus(transactionId: string) {
        const token = await this.getAuthToken();

        try {
            const response = await axios.get(`${API_BASE}/api/getInvoice/${transactionId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            console.log(`🏦 [RAW] Bank Response for ${transactionId}:`, JSON.stringify(response.data, null, 2));
            return response.data; // contains orderStatus (Paid, Pending, etc)
        } catch (error: any) {
            console.error("Paylink Status Check Error:", error.response?.data || error.message);
            throw new Error("Failed to check invoice status");
        }
    }
}
