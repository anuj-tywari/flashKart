import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./Order";
import { moneyTransformer, Product } from "./Product";

@Entity("order_items")
@Check("CHK_order_item_quantity", `"quantity" > 0`)
@Check("CHK_order_item_price", `"unitPrice" >= 0`)
export class OrderItem {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Order, (order) => order.items, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "orderId" })
    order: Order;

    @ManyToOne(() => Product, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "productId" })
    product: Product;

    @Column({ type: "int" })
    quantity: number;

    @Column({ type: "numeric", precision: 12, scale: 2, transformer: moneyTransformer })
    unitPrice: number;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;
}
