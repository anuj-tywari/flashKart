import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Product } from "./Product";
import { User } from "./User";

export enum ReservationStatus {
    HELD = "HELD",
    CONSUMED = "CONSUMED",
    RELEASED = "RELEASED",
    EXPIRED = "EXPIRED",
}

@Entity("reservations")
@Index("IDX_reservations_expiry", ["status", "expiresAt"])
@Check("CHK_reservation_quantity", `"quantity" > 0`)
@Check("CHK_reservation_status", `"status" IN ('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED')`)
export class Reservation {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, (user) => user.reservations, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "userId" })
    user: User;

    @ManyToOne(() => Product, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "productId" })
    product: Product;

    @Column({ type: "int" })
    quantity: number;

    @Column({ type: "varchar", length: 32, default: ReservationStatus.HELD })
    status: ReservationStatus;

    @Column({ type: "timestamptz" })
    expiresAt: Date;

    @Column({ type: "uuid", nullable: true })
    orderId: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
