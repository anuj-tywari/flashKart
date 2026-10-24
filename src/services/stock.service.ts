import { AppDataSource } from "../database";
import { Product } from "../entities/Product";
import { Reservation, ReservationStatus } from "../entities/Reservation";
import { redis } from "../redis";

const STOCK = (productId: string) => `flashkart:stock:${productId}`;
const RESERVATION = (reservationId: string) => `flashkart:reservation:${reservationId}`;
const HOLD = (userId: string, productId: string) => `flashkart:hold:${userId}:${productId}`;
const EXPIRING = "flashkart:expiring";

export type HoldPayload = {
    userId: string;
    productId: string;
    quantity: number;
    expiresAt: string;
};

const RESERVE_LUA = `
local existing = redis.call("GET", KEYS[3])
if existing then
  return {-1, existing}
end
local raw = redis.call("GET", KEYS[1])
if not raw then
  return {-2, "0"}
end
local stock = tonumber(raw)
local qty = tonumber(ARGV[1])
if stock < qty then
  return {0, tostring(stock)}
end
local remaining = stock - qty
redis.call("SET", KEYS[1], tostring(remaining))
redis.call("SET", KEYS[2], ARGV[2])
redis.call("SET", KEYS[3], ARGV[3])
redis.call("ZADD", KEYS[4], ARGV[4], ARGV[3])
return {1, tostring(remaining)}
`;

const RELEASE_LUA = `
local payload = redis.call("GET", KEYS[2])
local hold = redis.call("GET", KEYS[3])
if hold == ARGV[1] then
  redis.call("DEL", KEYS[3])
end
redis.call("ZREM", KEYS[4], ARGV[1])
if not payload then
  return 0
end
redis.call("DEL", KEYS[2])
redis.call("INCRBY", KEYS[1], tonumber(ARGV[2]))
return 1
`;

const CONSUME_LUA = `
local hold = redis.call("GET", KEYS[3])
if hold == ARGV[1] then
  redis.call("DEL", KEYS[3])
end
redis.call("DEL", KEYS[2])
redis.call("ZREM", KEYS[4], ARGV[1])
return 1
`;

export type ReserveResult =
    | { code: "OK"; remaining: number }
    | { code: "INSUFFICIENT"; available: number }
    | { code: "ALREADY_HELD"; reservationId: string }
    | { code: "UNINITIALIZED" };

function keysFor(userId: string, productId: string, reservationId: string): string[] {
    return [STOCK(productId), RESERVATION(reservationId), HOLD(userId, productId), EXPIRING];
}

export async function getAvailableStock(productId: string): Promise<number | null> {
    const raw = await redis.get(STOCK(productId));
    if (raw == null) {
        return null;
    }
    return Number(raw);
}

export async function ensureStock(productId: string): Promise<number> {
    const current = await getAvailableStock(productId);
    if (current != null) {
        return current;
    }

    const product = await AppDataSource.getRepository(Product).findOneBy({ id: productId });
    if (!product) {
        return 0;
    }

    const raw = await AppDataSource.getRepository(Reservation)
        .createQueryBuilder("reservation")
        .select("COALESCE(SUM(reservation.quantity), 0)", "held")
        .where(`reservation."productId" = :productId`, { productId })
        .andWhere("reservation.status = :status", { status: ReservationStatus.HELD })
        .andWhere("reservation.expiresAt > :now", { now: new Date() })
        .getRawOne<{ held: string }>();

    const available = Math.max(0, product.stock - Number(raw?.held ?? 0));
    await redis.set(STOCK(productId), String(available), { NX: true });
    return (await getAvailableStock(productId)) ?? available;
}

export async function tryReserve(input: {
    userId: string;
    productId: string;
    reservationId: string;
    quantity: number;
    expiresAt: Date;
    payload: HoldPayload;
}): Promise<ReserveResult> {
    const reply = await redis.eval(RESERVE_LUA, {
        keys: keysFor(input.userId, input.productId, input.reservationId),
        arguments: [
            String(input.quantity),
            JSON.stringify(input.payload),
            input.reservationId,
            String(input.expiresAt.getTime()),
        ],
    });

    if (!Array.isArray(reply) || reply.length < 2) {
        throw new Error("Unexpected Redis reserve reply");
    }

    const code = Number(reply[0]);
    const extra = String(reply[1]);
    if (code === 1) {
        return { code: "OK", remaining: Number(extra) };
    }
    if (code === 0) {
        return { code: "INSUFFICIENT", available: Number(extra) };
    }
    if (code === -1) {
        return { code: "ALREADY_HELD", reservationId: extra };
    }
    return { code: "UNINITIALIZED" };
}

export async function releaseHold(input: {
    userId: string;
    productId: string;
    reservationId: string;
    quantity: number;
}): Promise<boolean> {
    const reply = await redis.eval(RELEASE_LUA, {
        keys: keysFor(input.userId, input.productId, input.reservationId),
        arguments: [input.reservationId, String(input.quantity)],
    });
    return Number(reply) === 1;
}

export async function consumeHold(input: {
    userId: string;
    productId: string;
    reservationId: string;
}): Promise<void> {
    await redis.eval(CONSUME_LUA, {
        keys: [STOCK(input.productId), RESERVATION(input.reservationId), HOLD(input.userId, input.productId), EXPIRING],
        arguments: [input.reservationId],
    });
}

export async function readHold(reservationId: string): Promise<HoldPayload | null> {
    const raw = await redis.get(RESERVATION(reservationId));
    if (!raw) {
        return null;
    }
    return JSON.parse(raw) as HoldPayload;
}

export async function listDueReservationIds(limit: number): Promise<string[]> {
    const ids = await redis.zRangeByScore(EXPIRING, "-inf", Date.now(), {
        LIMIT: { offset: 0, count: limit },
    });
    return ids.map((id) => String(id));
}

export async function forgetReservation(reservationId: string): Promise<void> {
    await redis.zRem(EXPIRING, reservationId);
}
