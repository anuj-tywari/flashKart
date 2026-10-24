import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable ${name}`);
    }
    return value;
}

export const config = {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required("DATABASE_URL"),
    redisUrl: required("REDIS_URL"),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    reservationTtlMs: 5 * 60 * 1000,
};
