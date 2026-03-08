import { createClient } from "redis";

// ── In-Memory Map Fallback for Development ───────────────────
const memCache = new Map<string, string>();

const client = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});

client.on("error", (err) => console.log("⚠️ Redis connection failed, using Memory Cache instead."));

export const connectRedis = async () => {
    try {
        if (!client.isOpen) await client.connect();
    } catch (e) {
        // Fallback already logic already handled by client.on error above
    }
};

// Proxied redis object: checks real redis first, falls back to memory if needed
export const redis = {
    set: async (key: string, value: string, options?: any) => {
        try {
            if (client.isOpen) return await client.set(key, value, options);
        } catch { }
        memCache.set(key, value);
        return "OK";
    },
    get: async (key: string) => {
        try {
            if (client.isOpen) return await client.get(key);
        } catch { }
        return memCache.get(key) || null;
    },
    keys: async (pattern: string) => {
        try {
            if (client.isOpen) return await client.keys(pattern);
        } catch { }
        const regex = new RegExp(pattern.replace("*", ".*"));
        return Array.from(memCache.keys()).filter(k => regex.test(k));
    },
    del: async (key: string) => {
        try {
            if (client.isOpen) return await client.del(key);
        } catch { }
        memCache.delete(key);
        return 1;
    },
    // Set operations (Missing in previous version)
    sAdd: async (key: string, value: string) => {
        try {
            if (client.isOpen) return await client.sAdd(key, value);
        } catch { }
        const set = JSON.parse(memCache.get(key) || "[]");
        if (!set.includes(value)) set.push(value);
        memCache.set(key, JSON.stringify(set));
        return 1;
    },
    sMembers: async (key: string) => {
        try {
            if (client.isOpen) return await client.sMembers(key);
        } catch { }
        return JSON.parse(memCache.get(key) || "[]");
    },
    sRem: async (key: string, value: string) => {
        try {
            if (client.isOpen) return await client.sRem(key, value);
        } catch { }
        const set = JSON.parse(memCache.get(key) || "[]") as string[];
        const filtered = set.filter(v => v !== value);
        memCache.set(key, JSON.stringify(filtered));
        return 1;
    }
} as any;
