import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from "typeorm";
import { UserProfile } from "./UserProfile.js";

@Entity("purchases")
export class Purchase {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => UserProfile, (user) => user.purchases)
    @JoinColumn({ name: "user_id" })
    user!: Relation<UserProfile>;

    @Column()
    user_id!: string;

    @Column({ length: 50 })
    gem_package_id!: string;

    @Column()
    gems_amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: number;

    @Column({ length: 3, default: "USD" })
    currency!: string;

    @Column({ length: 50, nullable: true })
    payment_method!: string;

    @Column({ length: 255, unique: true, nullable: true })
    transaction_id!: string;

    @Column({ length: 20, default: "completed" })
    status!: string; // pending, completed, failed, refunded

    @CreateDateColumn()
    created_at!: Date;
}
