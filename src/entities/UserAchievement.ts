import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, type Relation } from "typeorm";
import { UserProfile } from "./UserProfile.js";
import { Achievement } from "./Achievement.js";

@Entity("user_achievements")
@Unique(["user_id", "achievement_id"])
export class UserAchievement {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => UserProfile, (user) => user.achievements)
    @JoinColumn({ name: "user_id" })
    user!: Relation<UserProfile>;

    @Column()
    user_id!: string;

    @ManyToOne(() => Achievement)
    @JoinColumn({ name: "achievement_id" })
    achievement!: Achievement;

    @Column()
    achievement_id!: string;

    @Column({ default: 0 })
    current_progress!: number;

    @Column({ default: false })
    is_completed!: boolean;

    @Column({ type: "timestamp", nullable: true })
    completed_at!: Date;

    @Column({ default: false })
    claimed_reward!: boolean;
}
