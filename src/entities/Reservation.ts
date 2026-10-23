import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
    OneToOne,
    ManyToOne,
    JoinColumn, Index
} from 'typeorm';
import {User} from "./User";
import {Product} from "./Product";

export  enum ReservationStatus {
    RESERVED = "RESERVED",
    APPROVED = "APPROVED",
    RELEASED = "RELEASED",
    EXPIRED = "EXPIRED"
}

@Entity('reservation')
@Index("reservation_status_idx", ["status"])
@Index("reservation_expired_at_idx", ["expiredAt"])
export class Reservation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, user => user.reservations, {
        nullable:false, onDelete: "RESTRICT"
    })
    @JoinColumn()
    user!: User;

    @ManyToOne(() => Product, {
        nullable:false, onDelete: "RESTRICT"
    })
    @JoinColumn()
    product!: Product;

    @Column({type: "integer"})
    quantity!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({type: "enum", enum: ReservationStatus, default: ReservationStatus.RESERVED})
    status!: ReservationStatus;

    @Column({type: "timestamp"})
    expiredAt!: Date;
}