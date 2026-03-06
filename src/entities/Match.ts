import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("matches")
export class Match {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    matchFee!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    prize!: number;

    @Column({ default: 2 })
    tableSize!: number;

    @Column({ default: 0 })
    tableJoined!: number;

    @Column({ default: 1 })
    type!: number; // 0 for computer, 1 for online, etc.

    @Column({ nullable: true })
    startTime!: string;

    @Column({ default: "pending" })
    resultStatus!: string;

    @Column({ nullable: true })
    winnerName!: string;

    @Column({ nullable: true })
    parti1Id!: string;

    @Column({ nullable: true })
    parti2Id!: string;

    @Column({ nullable: true })
    parti1Name!: string;

    @Column({ nullable: true })
    parti2Name!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
