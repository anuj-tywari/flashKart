import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
    OneToOne,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import {Cart} from "./Cart";
import {Product} from "./Product";

@Entity("cart_items")
export class CartItem{
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Cart, cart => cart.items,{
        nullable: false, onDelete: "CASCADE"
    })
    @JoinColumn()
    cart!: Cart;

    @ManyToOne(() => Product, {
        nullable: false, onDelete: "RESTRICT"
    })
    product!: Product

    @Column({type: "integer"})
    quantity!: number;
}
