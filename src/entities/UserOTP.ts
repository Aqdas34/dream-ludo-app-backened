import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("user_otps")
export class UserOTP {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    email!: string;

    @Column()
    otp!: string;

    @Column()
    type!: string; // 'registration' | 'reset'

    @Column({ type: "timestamp" })
    expiresAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;
}
