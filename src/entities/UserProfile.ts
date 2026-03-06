import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, type Relation } from "typeorm";
import { GemTransaction } from "./GemTransaction.js";
import { Purchase } from "./Purchase.js";
import { UserAchievement } from "./UserAchievement.js";

@Entity("user_profiles")
export class UserProfile {
    @PrimaryColumn()
    user_id!: string;

    @Column({ length: 100, nullable: true })
    display_name!: string;

    @Column({ type: "text", nullable: true })
    avatar_url!: string;

    @Column({ type: "int", default: 0 })
    gems_balance!: number;

    @Column({ type: "int", default: 0 })
    experience_points!: number;

    @Column({ type: "int", default: 1 })
    level!: number;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    last_login!: Date;

    @OneToMany(() => GemTransaction, (transaction) => transaction.user)
    gemTransactions!: Relation<GemTransaction>[];

    @OneToMany(() => Purchase, (purchase) => purchase.user)
    purchases!: Relation<Purchase>[];

    @OneToMany(() => UserAchievement, (ua) => ua.user)
    achievements!: Relation<UserAchievement>[];
}
