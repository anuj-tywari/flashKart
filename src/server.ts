import "dotenv/config";
import {app} from './app';
import {appDataSource} from "./database";
import {redis} from "./redis";

async function bootstrap() {
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
        throw new Error('Missing environment variables');
    }
    await appDataSource.initialize();
    await redis.connect();
    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
    const shutdown = async () => {
        server.close(async () => {
            try {
                if (redis.isOpen) {
                    await redis.disconnect();
                }
                if (appDataSource.isInitialized) {
                    await appDataSource.destroy();
                }
                process.exit(0);
            } catch (error) {
                console.error("shutdown error", error);
                process.exit(1);
            }
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

}


bootstrap().catch((error) => {
    console.error("bootstrap error", error);
    process.exit(1);
});