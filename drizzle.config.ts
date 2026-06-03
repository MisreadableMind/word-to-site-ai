import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./src/db/drizzle",
  schema: "./src/db/drizzle/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://wordtosite:wordtosite@localhost:5555/wordtosite",
  },
  casing: "snake_case",
});
