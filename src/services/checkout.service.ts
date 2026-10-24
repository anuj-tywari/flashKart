import { EntityManager } from "typeorm";
import { AppDataSource } from "../database";
import { AppError, isUniqueViolation } from "../errors";
import { Order, OrderStatus } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Product } from "../entities/Product";
import { Reservation, ReservationStatus } from "../entities/Reservation";
import { User } from "../entities/User";
import { lockReservation, removeCartItem } from "./reservation.service";
import { consumeHold, releaseHold } from "./stock.service";

export type OrderView = {
    orderId: string;
    status: OrderStatus;
    total: number;
    idempotencyKey: string;
    reservationId: string;
    idempotentReplay: boolean;
    items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
    }>;
};

function money(value: number): number {
    return Math.round(value * 100) / 100;
}

function toOrderView(order: Order, idempotentReplay: boolean): OrderView {
    return {
        orderId: order.id,
        status: order.status,
        total: Number(order.total),
        idempotencyKey: order.idempotencyKey,
        reservationId: order.reservationId,
        idempotentReplay,
        items: (order.items ?? []).map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
        })),
    };
}

async function findOwnedOrder(userId: string, idempotencyKey: string): Promise<Order | null> {
    return AppDataSource.getRepository(Order).findOne({
        where: { user: { id: userId }, idempotencyKey },
        relations: { items: { product: true } },
    });
}

async function loadOrder(manager: EntityManager, orderId: string): Promise<Order> {
    const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: { product: true } },
    });
    if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }
    return order;
}

export async function getOrder(userId: string, orderId: string): Promise<OrderView> {
    const order = await AppDataSource.getRepository(Order).findOne({
        where: { id: orderId, user: { id: userId } },
        relations: { items: { product: true } },
    });
    if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }
    return toOrderView(order, false);
}

export async function checkout(userId: string, reservationId: string, idempotencyKey: string): Promise<OrderView> {
    const existing = await findOwnedOrder(userId, idempotencyKey);
    if (existing) {
        if (existing.reservationId !== reservationId) {
            throw new AppError("This checkout key was already used for a different reservation", 409, "IDEMPOTENCY_CONFLICT");
        }
        return toOrderView(existing, true);
    }

    type CheckoutOutcome =
        | { type: "order"; orderId: string; userId: string; productId: string; reservationId: string }
        | { type: "replay"; order: Order }
        | { type: "release"; hold: { userId: string; productId: string; reservationId: string; quantity: number }; error: AppError };

    let outcome: CheckoutOutcome;
    try {
        outcome = await AppDataSource.transaction(async (manager) => {
            const reservation = await lockReservation(manager, reservationId);
            if (!reservation || reservation.userId !== userId) {
                throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
            }
            if (reservation.status === ReservationStatus.CONSUMED) {
                const prior = await manager.findOne(Order, {
                    where: { reservationId: reservation.id },
                    relations: { items: { product: true } },
                });
                if (prior && prior.idempotencyKey === idempotencyKey) {
                    return { type: "replay", order: prior };
                }
                throw new AppError("This reservation was already checked out", 409, "RESERVATION_CONSUMED");
            }
            if (reservation.status !== ReservationStatus.HELD) {
                throw new AppError("This reservation is no longer active", 409, "RESERVATION_CLOSED");
            }

            const hold = {
                userId: reservation.userId,
                productId: reservation.productId,
                reservationId: reservation.id,
                quantity: reservation.quantity,
            };

            if (new Date(reservation.expiresAt) <= new Date()) {
                await manager.update(Reservation, reservation.id, { status: ReservationStatus.EXPIRED });
                await removeCartItem(manager, reservation.userId, reservation.productId);
                return {
                    type: "release" as const,
                    hold,
                    error: new AppError("Reservation expired", 409, "RESERVATION_EXPIRED"),
                };
            }

            const products: Array<{ id: string; price: string; stock: number }> = await manager.query(
                `SELECT id, price, stock FROM products WHERE id = $1 FOR UPDATE`,
                [reservation.productId],
            );
            const product = products[0];
            if (!product || product.stock < reservation.quantity) {
                await manager.update(Reservation, reservation.id, { status: ReservationStatus.RELEASED });
                await removeCartItem(manager, reservation.userId, reservation.productId);
                return {
                    type: "release" as const,
                    hold,
                    error: new AppError("Not enough stock left to complete this order", 409, "INSUFFICIENT_STOCK"),
                };
            }

            const unitPrice = Number(product.price);
            const total = money(unitPrice * reservation.quantity);
            await manager.update(Product, product.id, { stock: product.stock - reservation.quantity });

            const order = await manager.save(manager.create(Order, {
                user: { id: userId } as User,
                idempotencyKey,
                reservationId: reservation.id,
                status: OrderStatus.CONFIRMED,
                total,
            }));
            await manager.save(manager.create(OrderItem, {
                order,
                product: { id: product.id } as Product,
                quantity: reservation.quantity,
                unitPrice,
            }));
            await manager.update(Reservation, reservation.id, {
                status: ReservationStatus.CONSUMED,
                orderId: order.id,
            });
            await removeCartItem(manager, userId, reservation.productId);

            return {
                type: "order" as const,
                orderId: order.id,
                userId: reservation.userId,
                productId: reservation.productId,
                reservationId: reservation.id,
            };
        });
    } catch (error) {
        if (isUniqueViolation(error)) {
            const replay = await findOwnedOrder(userId, idempotencyKey);
            if (replay && replay.reservationId === reservationId) {
                return toOrderView(replay, true);
            }
            throw new AppError("This reservation was already checked out", 409, "RESERVATION_CONSUMED");
        }
        throw error;
    }

    if (outcome.type === "replay") {
        return toOrderView(outcome.order, true);
    }
    if (outcome.type === "release") {
        await releaseHold(outcome.hold);
        throw outcome.error;
    }

    try {
        await consumeHold({
            userId: outcome.userId,
            productId: outcome.productId,
            reservationId: outcome.reservationId,
        });
    } catch (error) {
        console.error("Order is committed; sweeper will drop the Redis hold", error);
    }

    const order = await loadOrder(AppDataSource.manager, outcome.orderId);
    return toOrderView(order, false);
}
