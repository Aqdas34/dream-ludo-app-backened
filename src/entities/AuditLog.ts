import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLog {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    admin_id!: number;

    @Column()
    action!: string; // e.g., "DELETE_USER", "BAN_USER", "UPDATE_BALANCE", "TOGGLE_ADMIN"

    @Column({ type: "text", nullable: true })
    details!: string; // JSON or descriptive string

    @Column({ nullable: true })
    target_id!: string; // The ID of the user affected

    @CreateDateColumn()
    createdAt!: Date;
}
