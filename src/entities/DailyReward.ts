import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, OneToOne, JoinColumn, type Relation } from "typeorm";
import { UserProfile } from "./UserProfile.js";

@Entity("daily_rewards")
export class DailyReward {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @OneToOne(() => UserProfile)
    @JoinColumn({ name: "user_id" })
    user!: Relation<UserProfile>;

    @Column()
    user_id!: string;

    @Column({ default: 0 })
    streak_days!: number;

    @Column({ type: "date", nullable: true })
    last_claimed_date!: string;

    @Column({ default: 0 })
    total_claimed!: number;

    @UpdateDateColumn()
    updated_at!: Date;
}
