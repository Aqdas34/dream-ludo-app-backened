import rateLimit from "express-rate-limit";

/**
 * Highly restrictive limiter for sensitive security actions.
 * Limits the number of OTP/Registration/Password Reset attempts 
 * to prevent brute force and resource exhaustion.
 */
export const strictSecurityLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    limit: 5, // Limit each IP to 5 requests per `window`
    standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: 0,
        msg: "TOO MANY ATTEMPTS: Your security access has been temporarily restricted. Please try again in 30 minutes."
    },
    // Allows us to track users behind proxies if configured in index.ts
    validate: { xForwardedForHeader: false }, 
});

/**
 * Standard security limiter for general auth actions like Login.
 * Slightly more liberal but still prevents rapid brute-force.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // Limit each IP to 10 requests per `window`
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: 0,
        msg: "SECURITY ALERT: Multiple failed authorization attempts. Access locked for 15 minutes."
    },
});

/**
 * General platform limiter for standard API usage.
 */
export const generalApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: 0,
        msg: "PLATFORM OVERLOAD: You are sending too many requests. Relax and try again shortly."
    },
});
