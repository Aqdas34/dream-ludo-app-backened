import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function checkDatabases() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1234',
        database: 'postgres'
    };

    const client = new pg.Client(config);
    try {
        await client.connect();
        const res = await client.query('SELECT datname FROM pg_database');
        console.log("Databases found:", res.rows.map(r => r.datname));
    } catch (err) {
        console.error("❌ Link failed:", err);
    } finally {
        await client.end();
    }
}

checkDatabases();
