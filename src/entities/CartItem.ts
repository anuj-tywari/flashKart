import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { Cart } from "./Cart";
import { Product } from "./Product";

@Entity("cart_items")
@Unique("UQ_cart_item_product", ["cart", "product"])
@Check("CHK_cart_item_quantity", `"quantity" > 0`)
export class CartItem {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Cart, (cart) => cart.items, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "cartId" })
    cart: Cart;

    @ManyToOne(() => Product, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "productId" })
    product: Product;

    @Column({ type: "int" })
    quantity: number;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
