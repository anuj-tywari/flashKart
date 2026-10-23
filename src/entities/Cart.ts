import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
    OneToOne,
    Check,
    ManyToOne,
    JoinColumn
} from 'typeorm';

import {User} from "./User";
import {cartItem} from "./CartItem";

@Entity("carts")
export class Cart{
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({type: "decimal", precision: 10, scale: 2})
    price!: number;

    @ManyToOne(() => User, user => user.carts,{
        nullable:false, onDelete: "CASCADE"
})

    @JoinColumn()
    user!: User;

    @OneToMany(() => cartItem, item => item.cart, {
        cascade: true
    })
    items!: cartItem;

    @CreateDateColumn()
    createdAt!: Date;
}