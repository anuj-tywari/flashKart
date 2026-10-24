import "reflect-metadata";
import { randomUUID } from "crypto";
import { Server } from "http";
import { AddressInfo } from "net";
import { app } from "../app";
import { AppDataSource } from "../database";
import { Order } from "../entities/Order";
import { Product } from "../entities/Product";
import { Reservation, ReservationStatus } from "../entities/Reservation";
import { User } from "../entities/User";
import { redis } from "../redis";
import { seedIfEmpty } from "../seed";
import { checkout } from "../services/checkout.service";
import { createReservation } from "../services/reservation.service";
import { getAvailableStock } from "../services/stock.service";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function main(): Promise<void> {
    await AppDataSource.initialize();
    await redis.connect();
    await seedIfEmpty();

    const users = AppDataSource.getRepository(User);
    const products = AppDataSource.getRepository(Product);
    const stock = 20;
    const attempts = 50;
    const product = await products.save(products.create({
        name: `Probe ${randomUUID().slice(0, 8)}`,
        description: "Concurrency probe",
        price: 100,
        stock,
        isActive: true,
        saleEndsAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
    const buyers = await Promise.all(Array.from({ length: attempts }, (_, index) => users.save(users.create({
        firstName: "Probe",
        lastName: String(index),
        email: `probe-${product.id}-${index}@flashkart.local`,
        isActive: true,
    }))));

    const results = await Promise.all(buyers.map(async (buyer) => {
        try {
            return { ok: true as const, reservation: await createReservation(buyer.id, product.id, 1) };
        } catch (error) {
            const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNKNOWN";
            return { ok: false as const, code };
        }
    }));

    const reserved = results.flatMap((result) => result.ok ? [result] : []);
    const rejected = results.flatMap((result) => result.ok ? [] : [result]);
    assert(reserved.length === stock, `expected ${stock} reserves, got ${reserved.length}`);
    assert(rejected.every((result) => result.code === "INSUFFICIENT_STOCK"), "unexpected rejection");
    assert(await getAvailableStock(product.id) === 0, "redis stock was not drained");
    assert(await AppDataSource.getRepository(Reservation).count({
        where: { product: { id: product.id }, status: ReservationStatus.HELD },
    }) === stock, "held rows mismatch");

    const winner = reserved[0];
    const buyer = buyers[results.findIndex((result) => result.ok && result.reservation.reservationId === winner.reservation.reservationId)];
    const key = `probe-${randomUUID()}`;
    const order = await checkout(buyer.id, winner.reservation.reservationId, key);
    const replay = await checkout(buyer.id, winner.reservation.reservationId, key);
    assert(order.orderId === replay.orderId && replay.idempotentReplay, "idempotent replay failed");
    assert(await AppDataSource.getRepository(Order).count({ where: { reservationId: winner.reservation.reservationId } }) === 1, "duplicate order");

    const server: Server = await new Promise((resolve) => {
        const listening = app.listen(0, () => resolve(listening));
    });
    const port = (server.address() as AddressInfo).port;
    const clientId = randomUUID();
    const sessionResponse = await fetch(`http://127.0.0.1:${port}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId }),
    });
    assert(sessionResponse.status === 200, "session failed");
    const session = await sessionResponse.json() as { userId: string };
    const again = await fetch(`http://127.0.0.1:${port}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId }),
    });
    const second = await again.json() as { userId: string };
    assert(session.userId === second.userId, "same browser did not keep the same user");
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

    await redis.disconnect();
    await AppDataSource.destroy();
    console.log("verify passed");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
