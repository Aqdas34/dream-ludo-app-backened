import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";

export enum RewardType {
    DAILY_LOGIN = "DAILY_LOGIN",
    GAME_WIN = "GAME_WIN",
    GAME_PARTICIPATION = "GAME_PARTICIPATION",
    REFERRAL = "REFERRAL",
    REDEEM = "REDEEM",
    PURCHASE = "PURCHASE"
}

@Entity("reward_histories")
export class RewardHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne("User", "rewardHistories")
    user!: any;

    @Column()
    amount!: number;

    @Column({
        type: "enum",
        enum: RewardType
    })
    type!: RewardType;

    @Column({ nullable: true })
    description!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
