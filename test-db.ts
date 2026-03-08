import "reflect-metadata";
import { AppDataSource } from "./src/data-source.js";

console.log("Testing DB connection...");
AppDataSource.initialize()
    .then(() => {
        console.log("✅ DB Connected!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ DB Connection Failed:");
        console.error(err);
        process.exit(1);
    });
