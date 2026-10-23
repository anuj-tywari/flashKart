import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index} from "typeorm";
import {Cart} from './Cart'
import {Order} from './Order'
import {Reservation} from './Reservation'

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({unique: true, length: 255})
    @Index()
    email!: string;

    @OneToMany(() => Cart, cart => cart.user)
    carts!: Cart[];

    @OneToMany(() => Order, order => order.user)
    orders!: Order[];

    @OneToMany(() => Reservation, reservation => reservation.user)
    reservations!: Reservation[];

    @CreateDateColumn()
    createdAt!: Date;

}