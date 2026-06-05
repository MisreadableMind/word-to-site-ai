import { drizzle } from "drizzle-orm/node-postgres";
import pool from "../db";
import * as schema from "./drizzle/schema";
import * as relations from "./drizzle/relations";

export const db = drizzle({
  client: pool,
  schema: { ...schema, ...relations },
  casing: "snake_case",
});

export { pool };
export * from "./drizzle/schema";
