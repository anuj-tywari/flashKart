import express from 'express';
import { router } from "./routes/flashkart.routes";
import { errorHandler } from "./middlewares/error.middleware.ts";

export const app = express();

app.disable('x-powered-by');

app.use(express.json({limit: '32kb'}));

app.get('/health', (req, res) => {
  res.status(200).json({message: 'Welcome to Flashkart'});
});

app.use(router);

app.use(errorHandler);
