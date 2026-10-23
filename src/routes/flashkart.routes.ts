import {Router, Request, Response, NextFunction} from 'express';
import {z} from 'zod';
import {reservationService} from '../services/reservation.service';
import {checkoutService} from '../services/checkout.service';

export const router = Router();
type authenticatedRequest = Request & { user: { id: string } };

function requireUser(req: authenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.header("x-user-id");
    if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
    }
    req.user = {id: userId};
    next();
}

const reservationSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
});

router.post('/cart/reserve', requireUser, async (req: authenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const body = reservationSchema.parse(req.body);
        const reservation = await reservationService.createReservation(
            req.user!.id, body.productId, body.quantity
        );
        return res.status(201).json(reservation);
    } catch (err) {
        next(err);
    }
});

const checkoutSchema = z.object({
    reservationId: z.string().uuid(),
});

router.post('/cart/checkout', requireUser, async (req: authenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const body = checkoutSchema.parse(req.body);
        const key = req.header('x-checkout-key');
        if (!key) {
            return res.status(400).json({error: 'Missing checkout key'});
        }
        const order = await checkoutService.checkout(
          req.user!.id, body.reservationId
        );

        return res.status(200).json(order);
    } catch (err) {
        next(err);
    }
});
