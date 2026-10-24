import "reflect-metadata";
import { app } from "./app";
import { config } from "./config";
import { AppDataSource } from "./database";
import { redis } from "./redis";
import { seedIfEmpty } from "./seed";
import { sweepExpired } from "./services/reservation.service";

async function bootstrap(): Promise<void> {
    await AppDataSource.initialize();
    await redis.connect();
    await seedIfEmpty();

    const sweeper = setInterval(() => {
        sweepExpired().catch((error) => console.error("sweep failed", error));
    }, 5000);

    const server = app.listen(config.port, () => {
        console.log(`FlashKart API listening on ${config.port}`);
    });

    const shutdown = () => {
        clearInterval(sweeper);
        server.close(() => {
            Promise.allSettled([
                redis.isOpen ? redis.disconnect() : Promise.resolve(),
                AppDataSource.isInitialized ? AppDataSource.destroy() : Promise.resolve(),
            ]).finally(() => process.exit(0));
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
    console.error("bootstrap error", error);
    process.exit(1);
});