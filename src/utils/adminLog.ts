export async function recordAdminLog(adminId: number, action: string, targetId: string, details: any) {
    try {
        const { AppDataSource } = await import("../data-source.js");
        const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
        
        await AppDataSource.query(
            `INSERT INTO audit_logs (id, admin_id, action, target_id, details, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
            [adminId, action, targetId, detailsStr]
        );
    } catch (e) {
        console.error("ADMIN LOGGING FAILED:", e);
    }
}
