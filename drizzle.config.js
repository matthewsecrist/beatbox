import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/server/db/schema.js",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:beatbox.db" },
})
