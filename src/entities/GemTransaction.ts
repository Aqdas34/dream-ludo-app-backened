import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from "typeorm";
import { UserProfile } from "./UserProfile.js";

@Entity("gem_transactions")
export class GemTransaction {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => UserProfile, (user) => user.gemTransactions)
    @JoinColumn({ name: "user_id" })
    user!: Relation<UserProfile>;

    @Column()
    user_id!: string;

    @Column()
    amount!: number;

    @Column({ length: 50 })
    transaction_type!: string; // purchase, reward, spend, refund

    @Column({ type: "text", nullable: true })
    description!: string;

    @Column({ type: "uuid", nullable: true })
    reference_id!: string;

    @CreateDateColumn()
    created_at!: Date;
}
