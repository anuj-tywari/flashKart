import express from "express";
import { config } from "./config";
import { errorHandler } from "./middlewares/error.middleware";
import { router } from "./routes/flashkart.routes";

export const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id, x-idempotency-key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
    res.status(200).json({ message: "Welcome to FlashKart" });
});

app.use(router);
app.use(errorHandler);
