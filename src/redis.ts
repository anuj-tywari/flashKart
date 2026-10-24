import { createClient } from "redis";
import { config } from "./config";

export const redis = createClient({
    url: config.redisUrl,
    socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
});

redis.on("error", (error) => {
    console.error("Redis client error", error);
});
