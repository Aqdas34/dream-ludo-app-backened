import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from "typeorm";
import { UserProfile } from "./UserProfile.js";

@Entity("game_rewards")
export class GameReward {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    game_id!: string;

    @ManyToOne(() => UserProfile)
    @JoinColumn({ name: "user_id" })
    user!: Relation<UserProfile>;

    @Column()
    user_id!: string;

    @Column({ length: 50 })
    reward_type!: string; // win_streak, perfect_game, capture_all, etc.

    @Column()
    gems_earned!: number;

    @Column()
    xp_earned!: number;

    @CreateDateColumn()
    created_at!: Date;
}
