import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { OrderItem } from "./OrderItem";
import { moneyTransformer } from "./Product";
import { User } from "./User";

export enum OrderStatus {
    CONFIRMED = "CONFIRMED",
    CANCELLED = "CANCELLED",
}

@Entity("orders")
@Unique("UQ_orders_user_idempotency", ["user", "idempotencyKey"])
@Unique("UQ_orders_reservation", ["reservationId"])
@Check("CHK_order_total", `"total" >= 0`)
@Check("CHK_order_status", `"status" IN ('CONFIRMED', 'CANCELLED')`)
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, (user) => user.orders, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ type: "varchar", length: 128 })
    idempotencyKey: string;

    @Column({ type: "uuid" })
    reservationId: string;

    @Column({ type: "varchar", length: 32, default: OrderStatus.CONFIRMED })
    status: OrderStatus;

    @Column({ type: "numeric", precision: 12, scale: 2, transformer: moneyTransformer })
    total: number;

    @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
    items: OrderItem[];

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
