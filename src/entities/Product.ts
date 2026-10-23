import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, OneToOne, Check} from 'typeorm';

@Entity("products")
@Check("CHK_product_stock", "stock >= 0")
@Check("CHK_product_price", "price >= 0")
export class Product {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({type: "varchar", length: 255})
    name!: string;

    @Column({type: "decimal", precision: 10, scale: 2})
    price!: number;

    @Column({type: "integer", default: 0})
    stock!: number;

    @Column({default:true})
    isActive!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @CreateDateColumn()
    updatedAt!: Date;
}


