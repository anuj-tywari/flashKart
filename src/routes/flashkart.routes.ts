import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { AppError } from "../errors";
import { getFeaturedProduct, getProduct, openSession } from "../services/catalog.service";
import { checkout, getOrder } from "../services/checkout.service";
import { createReservation, getReservation, releaseReservation } from "../services/reservation.service";

export const router = Router();

const uuidSchema = z.string().uuid();

function requireUser(req: Request, res: Response, next: NextFunction): void {
    const parsed = uuidSchema.safeParse(req.header("x-user-id"));
    if (!parsed.success) {
        next(new AppError("A valid x-user-id header is required", 401, "UNAUTHORIZED"));
        return;
    }
    res.locals.userId = parsed.data;
    next();
}

function requireIdempotencyKey(req: Request): string {
    const parsed = z.string().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/).safeParse(req.header("x-idempotency-key")?.trim());
    if (!parsed.success) {
        throw new AppError("A valid x-idempotency-key header is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
    }
    return parsed.data;
}

router.post("/session", async (req, res, next) => {
    try {
        const clientId = uuidSchema.parse(req.body?.clientId);
        res.status(200).json(await openSession(clientId));
    } catch (error) {
        next(error);
    }
});

router.get("/products/featured", async (_req, res, next) => {
    try {
        res.status(200).json(await getFeaturedProduct());
    } catch (error) {
        next(error);
    }
});

router.get("/products/:productId", async (req, res, next) => {
    try {
        res.status(200).json(await getProduct(uuidSchema.parse(req.params.productId)));
    } catch (error) {
        next(error);
    }
});

router.post("/cart/reserve", requireUser, async (req, res, next) => {
    try {
        const body = z.object({
            productId: uuidSchema,
            quantity: z.number().int().min(1).max(5),
        }).parse(req.body);
        const reservation = await createReservation(res.locals.userId as string, body.productId, body.quantity);
        res.status(reservation.reused ? 200 : 201).json(reservation);
    } catch (error) {
        next(error);
    }
});

router.get("/reservations/:reservationId", requireUser, async (req, res, next) => {
    try {
        const reservationId = uuidSchema.parse(req.params.reservationId);
        res.status(200).json(await getReservation(res.locals.userId as string, reservationId));
    } catch (error) {
        next(error);
    }
});

router.delete("/reservations/:reservationId", requireUser, async (req, res, next) => {
    try {
        const reservationId = uuidSchema.parse(req.params.reservationId);
        res.status(200).json(await releaseReservation(res.locals.userId as string, reservationId));
    } catch (error) {
        next(error);
    }
});

router.post("/order/checkout", requireUser, async (req, res, next) => {
    try {
        const body = z.object({ reservationId: uuidSchema }).parse(req.body);
        const order = await checkout(res.locals.userId as string, body.reservationId, requireIdempotencyKey(req));
        res.status(order.idempotentReplay ? 200 : 201).json(order);
    } catch (error) {
        next(error);
    }
});

router.get("/orders/:orderId", requireUser, async (req, res, next) => {
    try {
        res.status(200).json(await getOrder(res.locals.userId as string, uuidSchema.parse(req.params.orderId)));
    } catch (error) {
        next(error);
    }
});
