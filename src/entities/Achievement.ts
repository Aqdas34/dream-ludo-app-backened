import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("achievements")
export class Achievement {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ length: 100, unique: true })
    achievement_key!: string;

    @Column({ length: 255 })
    name!: string;

    @Column({ type: "text", nullable: true })
    description!: string;

    @Column({ length: 50, nullable: true })
    category!: string; // gameplay, social, special

    @Column({ default: 0 })
    reward_gems!: number;

    @Column({ default: 0 })
    reward_xp!: number;

    @Column({ type: "text", nullable: true })
    icon_url!: string;

    @Column({ default: 1 })
    max_progress!: number;

    @Column({ default: false })
    is_hidden!: boolean;

    @CreateDateColumn()
    created_at!: Date;
}
