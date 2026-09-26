import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL не задан в .env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  verbose: true,
  strict: false,
});
