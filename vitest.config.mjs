import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // beforeAll builds an in-process Postgres from the real migrations and
    // seeds (see tests/db.ts), which takes a few seconds.
    hookTimeout: 120_000,
  },
});
