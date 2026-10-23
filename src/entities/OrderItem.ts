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
import {Order} from "./Order";
import {Product} from "./Product";

@Entity("order_item")
@Check("CHK_order_item_quantity", '"quantity" > 0')
export class OrderItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Order, order => order.orderItem,{
        nullable: false, onDelete: "CASCADE"
    })
    @JoinColumn()
    order!: Order;

    @ManyToOne(() => Product,{
        nullable: false, onDelete: "RESTRICT"
    })
    @JoinColumn()
    product!: Product;

    @Column("int")
    quantity!: number;

    @Column("decimal", {precision: 10, scale: 2})
    price!: number;

    @CreateDateColumn()
    created_at!: Date;
}