import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { User } from "./User.js";

@Entity("notifications")
export class Notification {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    title!: string;

    @Column({ type: "text" })
    message!: string;

    @Column({ default: "info" }) // info, alert, reward, game
    type!: string;

    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    user!: User | null; // null means system-wide broadcast

    @Column({ default: false })
    isRead!: boolean;

    @CreateDateColumn()
    createdAt!: Date;
}
