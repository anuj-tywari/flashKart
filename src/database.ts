import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { Cart } from "./entities/Cart";
import { CartItem } from "./entities/CartItem";
import { Order } from "./entities/Order";
import { OrderItem } from "./entities/OrderItem";
import { Product } from "./entities/Product";
import { Reservation } from "./entities/Reservation";
import { User } from "./entities/User";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: config.databaseUrl,
    entities: [User, Product, Cart, CartItem, Reservation, Order, OrderItem],
    synchronize: true,
    logging: ["error", "schema"],
    extra: {
        max: 30,
        connectionTimeoutMillis: 10000,
    },
});
