import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("gem_packages")
export class GemPackage {
    @PrimaryColumn({ length: 50 })
    id!: string; // small, medium, large, etc.

    @Column({ length: 100 })
    name!: string;

    @Column()
    gems_amount!: number;

    @Column({ default: 0 })
    bonus_gems!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: number;

    @Column({ length: 3, default: "USD" })
    currency!: string;

    @Column({ default: 0 })
    discount_percent!: number;

    @Column({ default: false })
    is_popular!: boolean;

    @Column({ type: "text", nullable: true })
    icon_url!: string;

    @Column({ default: 0 })
    sort_order!: number;

    @Column({ default: true })
    is_active!: boolean;
}
