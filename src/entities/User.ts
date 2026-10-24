import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Cart } from "./Cart";
import { Order } from "./Order";
import { Reservation } from "./Reservation";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 100 })
    firstName: string;

    @Column({ type: "varchar", length: 100 })
    lastName: string;

    @Index("UQ_users_email", { unique: true })
    @Column({ type: "varchar", length: 255 })
    email: string;

    @Column({ type: "boolean", default: true })
    isActive: boolean;

    @OneToMany(() => Cart, (cart) => cart.user)
    carts: Cart[];

    @OneToMany(() => Order, (order) => order.user)
    orders: Order[];

    @OneToMany(() => Reservation, (reservation) => reservation.user)
    reservations: Reservation[];

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
