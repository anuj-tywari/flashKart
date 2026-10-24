import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CartItem } from "./CartItem";
import { User } from "./User";

export enum CartStatus {
    ACTIVE = "ACTIVE",
    CHECKED_OUT = "CHECKED_OUT",
}

@Entity("carts")
@Index("IDX_carts_user_status", ["user", "status"])
export class Cart {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, (user) => user.carts, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ type: "varchar", length: 32, default: CartStatus.ACTIVE })
    status: CartStatus;

    @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
    items: CartItem[];

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
