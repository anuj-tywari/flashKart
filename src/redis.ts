import { createClient } from "redis";

export const redis = createClient({
    url: process.env.REDIS_URL,
    socket: {
        connectTimeout: 5000,
        reconnectStrategy: retries => Math.min(retries * 100, 3000)
    }
});

redis.on('error', err => console.log('Redis Client Error', err));
