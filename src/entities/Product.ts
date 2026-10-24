import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export const moneyTransformer = {
    to: (value: number | null) => value,
    from: (value: string | null) => (value == null ? 0 : Number(value)),
};

@Entity("products")
@Check("CHK_product_stock", `"stock" >= 0`)
@Check("CHK_product_price", `"price" >= 0`)
export class Product {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ type: "text", default: "" })
    description: string;

    @Column({ type: "numeric", precision: 12, scale: 2, transformer: moneyTransformer })
    price: number;

    @Column({ type: "int", default: 0 })
    stock: number;

    @Column({ type: "boolean", default: true })
    isActive: boolean;

    @Column({ type: "timestamptz", nullable: true })
    saleEndsAt: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
