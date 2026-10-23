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

import {User} from './User';
import {OrderItem} from './OrderItem';

export enum OrderStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

@Entity('orders')
@Index(['user', "idempotency_key"], { unique: true })
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, user => user.orders,{
        nullable: false, onDelete: "RESTRICT"
    })
    user!: User;

    @Column({length:128})
    idempotency_key!: string;

    @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
    status!: OrderStatus;

    @Column({type: 'integer'})
    price!: number;

    @ManyToOne(() => OrderItem, orderItem => orderItem.order,{
       cascade:true
    })
    orderItem!: OrderItem;

    @CreateDateColumn()
    created_at!: Date;
}