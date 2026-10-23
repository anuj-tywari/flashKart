import {randomUUID} from "crypto";
import {AppDataSource} from "../database";
import {redis} from "../redis";
import {Product} from "../entities/Product";
import {Reservation, ReservationStatus} from "../entities/Reservation";

const Reservation_MS = 5 * 60 * 1000

const RESERVE_LUA = ' local stock = number(redis.call("get", KEYS[1])) if stock <= 0 then return 0 end redis.call("set", KEYS[1], stock - ARGV[1]) return stock';

