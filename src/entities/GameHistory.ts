import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User.js";

export enum GameResultStatus {
    COMPLETED = "COMPLETED",
    LEFT = "LEFT",
    ONGOING = "ONGOING"
}

@Entity("game_histories")
export class GameHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    roomId!: string;

    @Column()
    userId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @Column("text")
    playersJson!: string; // JSON string of players

    @Column({ nullable: true })
    winnerId!: string;

    @Column({ nullable: true })
    winnerName!: string;

    @Column({
        type: "enum",
        enum: GameResultStatus,
        default: GameResultStatus.ONGOING
    })
    status!: GameResultStatus;

    @Column({ default: 0 })
    gemsAwarded!: number;

    @CreateDateColumn()
    createdAt!: Date;
}
