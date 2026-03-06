import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ nullable: true })
    fullName!: string;

    @Column({ unique: true })
    username!: string;

    @Column({ unique: true })
    email!: string;

    @Column({ select: false })
    password!: string;

    @Column({ nullable: true })
    mobile!: string;

    @Column({ nullable: true })
    countryCode!: string;

    @Column({ nullable: true })
    profileImg!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    depositBal!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    wonBal!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    bonusBal!: number;

    @Column({ default: 0 })
    totalWins!: number;

    @Column({ default: 0 })
    totalGames!: number;

    @Column({ default: 0 })
    gems!: number;

    @Column({ nullable: true })
    gender!: string; // 'MALE' | 'FEMALE'

    @Column({ unique: true, nullable: true })
    referralCode!: string;

    @Column({ nullable: true })
    referredBy!: string;

    @Column({ type: "timestamp", nullable: true })
    lastDailyClaim!: Date | null;

    @OneToMany("RewardHistory", "user")
    rewardHistories!: any[];

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ default: false })
    isAdmin!: boolean;

    @Column({ default: false })
    isProfileCompleted!: boolean;

    @UpdateDateColumn()
    updatedAt!: Date;
}
