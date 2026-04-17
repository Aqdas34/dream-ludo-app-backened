import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("admin_otps")
export class AdminOTP {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    email!: string;

    @Column()
    otp!: string;

    @Column({ type: "timestamp" })
    expiresAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;
}
