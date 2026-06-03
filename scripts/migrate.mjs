import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://wordtosite:wordtosite@localhost:5555/wordtosite",
});
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "src/db/drizzle" });
await pool.end();
console.log("[migrate] database schema up to date");
