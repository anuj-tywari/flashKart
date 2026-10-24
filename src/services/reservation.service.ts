import { randomUUID } from "crypto";
import { EntityManager } from "typeorm";
import { config } from "../config";
import { AppDataSource } from "../database";
import { AppError } from "../errors";
import { Cart, CartStatus } from "../entities/Cart";
import { CartItem } from "../entities/CartItem";
import { Product } from "../entities/Product";
import { Reservation, ReservationStatus } from "../entities/Reservation";
import { User } from "../entities/User";
import {
    consumeHold,
    ensureStock,
    forgetReservation,
    getAvailableStock,
    listDueReservationIds,
    readHold,
    releaseHold,
    tryReserve,
} from "./stock.service";

export type ReservationView = {
    reservationId: string;
    productId: string;
    quantity: number;
    status: ReservationStatus;
    expiresAt: string;
    remainingStock: number | null;
    reused: boolean;
};

type ReservationRow = {
    id: string;
    userId: string;
    productId: string;
    quantity: number;
    status: ReservationStatus;
    expiresAt: Date;
    orderId: string | null;
};

export async function lockReservation(manager: EntityManager, reservationId: string): Promise<ReservationRow | null> {
    const rows: ReservationRow[] = await manager.query(
        `SELECT id, "userId", "productId", quantity, status, "expiresAt", "orderId"
         FROM reservations
         WHERE id = $1
         FOR UPDATE`,
        [reservationId],
    );
    return rows[0] ?? null;
}

export async function removeCartItem(manager: EntityManager, userId: string, productId: string): Promise<void> {
    const items = await manager.find(CartItem, {
        where: {
            product: { id: productId },
            cart: { user: { id: userId }, status: CartStatus.ACTIVE },
        },
    });
    if (items.length > 0) {
        await manager.remove(items);
    }
}

async function rememberCartItem(manager: EntityManager, userId: string, productId: string, quantity: number): Promise<void> {
    let cart = await manager.findOne(Cart, {
        where: { user: { id: userId }, status: CartStatus.ACTIVE },
    });
    if (!cart) {
        cart = await manager.save(manager.create(Cart, {
            user: { id: userId } as User,
            status: CartStatus.ACTIVE,
        }));
    }

    const existing = await manager.findOne(CartItem, {
        where: { cart: { id: cart.id }, product: { id: productId } },
    });
    if (existing) {
        existing.quantity = quantity;
        await manager.save(existing);
        return;
    }

    await manager.save(manager.create(CartItem, {
        cart: { id: cart.id } as Cart,
        product: { id: productId } as Product,
        quantity,
    }));
}

async function toView(reservation: Reservation, productId: string, reused: boolean): Promise<ReservationView> {
    return {
        reservationId: reservation.id,
        productId,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: new Date(reservation.expiresAt).toISOString(),
        remainingStock: await getAvailableStock(productId),
        reused,
    };
}

export async function getReservation(userId: string, reservationId: string): Promise<ReservationView> {
    const reservation = await AppDataSource.getRepository(Reservation).findOne({
        where: { id: reservationId, user: { id: userId } },
        relations: { product: true },
    });
    if (!reservation?.product) {
        throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }
    if (reservation.status === ReservationStatus.HELD && reservation.expiresAt <= new Date()) {
        await expireReservation(reservationId);
        reservation.status = ReservationStatus.EXPIRED;
    }
    return toView(reservation, reservation.product.id, false);
}

export async function createReservation(userId: string, productId: string, quantity: number): Promise<ReservationView> {
    await sweepExpired(25);

    const user = await AppDataSource.getRepository(User).findOneBy({ id: userId, isActive: true });
    if (!user) {
        throw new AppError("User not found", 401, "UNAUTHORIZED");
    }

    const product = await AppDataSource.getRepository(Product).findOneBy({ id: productId, isActive: true });
    if (!product) {
        throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }
    if (product.saleEndsAt && product.saleEndsAt <= new Date()) {
        throw new AppError("This flash sale has ended", 409, "SALE_ENDED");
    }

    await ensureStock(product.id);

    const reservationId = randomUUID();
    const expiresAt = new Date(Date.now() + config.reservationTtlMs);
    const payload = { userId, productId, quantity, expiresAt: expiresAt.toISOString() };

    let result = await tryReserve({ userId, productId, reservationId, quantity, expiresAt, payload });
    if (result.code === "UNINITIALIZED") {
        await ensureStock(product.id);
        result = await tryReserve({ userId, productId, reservationId, quantity, expiresAt, payload });
    }

    if (result.code === "ALREADY_HELD") {
        const released = await expireReservation(result.reservationId);
        if (!released) {
            const existing = await AppDataSource.getRepository(Reservation).findOne({
                where: { id: result.reservationId, user: { id: userId } },
                relations: { product: true },
            });
            if (existing?.product && existing.status === ReservationStatus.HELD && existing.expiresAt > new Date()) {
                return toView(existing, existing.product.id, true);
            }
            throw new AppError("You already have a reservation for this product", 409, "ALREADY_RESERVED");
        }
        result = await tryReserve({ userId, productId, reservationId, quantity, expiresAt, payload });
    }

    if (result.code === "INSUFFICIENT") {
        throw new AppError("Not enough stock left to reserve", 409, "INSUFFICIENT_STOCK", {
            available: result.available,
        });
    }
    if (result.code !== "OK") {
        throw new AppError("Stock is not ready for reservation", 503, "STOCK_UNAVAILABLE");
    }

    try {
        const saved = await AppDataSource.transaction(async (manager) => {
            const reservation = await manager.save(manager.create(Reservation, {
                id: reservationId,
                user: { id: userId } as User,
                product: { id: productId } as Product,
                quantity,
                status: ReservationStatus.HELD,
                expiresAt,
                orderId: null,
            }));
            await rememberCartItem(manager, userId, productId, quantity);
            reservation.product = product;
            return reservation;
        });
        return {
            ...(await toView(saved, productId, false)),
            remainingStock: result.remaining,
        };
    } catch (error) {
        await releaseHold({ userId, productId, reservationId, quantity });
        throw error;
    }
}

export async function releaseReservation(userId: string, reservationId: string): Promise<ReservationView> {
    const released = await AppDataSource.transaction(async (manager) => {
        const row = await lockReservation(manager, reservationId);
        if (!row || row.userId !== userId) {
            throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
        }
        if (row.status !== ReservationStatus.HELD) {
            return null;
        }
        await manager.update(Reservation, row.id, { status: ReservationStatus.RELEASED });
        await removeCartItem(manager, row.userId, row.productId);
        return row;
    });

    if (released) {
        await releaseHold({
            userId: released.userId,
            productId: released.productId,
            reservationId: released.id,
            quantity: released.quantity,
        });
    }

    return getReservation(userId, reservationId);
}

export async function expireReservation(reservationId: string): Promise<boolean> {
    const decision = await AppDataSource.transaction(async (manager) => {
        const row = await lockReservation(manager, reservationId);
        if (!row) {
            const payload = await readHold(reservationId);
            if (!payload) {
                await forgetReservation(reservationId);
            }
            return payload
                ? { action: "release" as const, ...payload, reservationId }
                : { action: "drop" as const };
        }
        if (row.status === ReservationStatus.CONSUMED) {
            return { action: "consume" as const, userId: row.userId, productId: row.productId, reservationId: row.id };
        }
        if (row.status === ReservationStatus.RELEASED || row.status === ReservationStatus.EXPIRED) {
            return {
                action: "release" as const,
                userId: row.userId,
                productId: row.productId,
                quantity: row.quantity,
                reservationId: row.id,
            };
        }
        if (row.expiresAt > new Date()) {
            return { action: "keep" as const };
        }
        await manager.update(Reservation, row.id, { status: ReservationStatus.EXPIRED });
        await removeCartItem(manager, row.userId, row.productId);
        return {
            action: "release" as const,
            userId: row.userId,
            productId: row.productId,
            quantity: row.quantity,
            reservationId: row.id,
        };
    });

    if (decision.action === "keep" || decision.action === "drop") {
        return false;
    }
    if (decision.action === "consume") {
        await consumeHold(decision);
        return false;
    }
    return releaseHold(decision);
}

export async function sweepExpired(limit = 50): Promise<number> {
    const ids = await listDueReservationIds(limit);
    let released = 0;
    for (const id of ids) {
        if (await expireReservation(id)) {
            released += 1;
        }
    }
    return released;
}
