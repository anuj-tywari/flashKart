import "reflect-metadata"
import { DataSource } from "typeorm";
import { Order } from "./entities/Order";
import { OrderItem } from "./entities/OrderItem";
import { Product } from "./entities/Product";
import {Cart} from "./entities/Cart";
import {CartItem} from "./entities/CartItem";
import {User} from "./entities/User";
import {Reservation} from "./entities/Reservation";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [Order, OrderItem, Product, Cart, CartItem, User, Reservation],
    synchronize: true,
    logging: true,
    extra: {
        max:20,
        connectionTimeoutMillis: 5000
    }

})