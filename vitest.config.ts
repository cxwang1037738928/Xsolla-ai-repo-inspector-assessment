import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run build` emits compiled copies of the suite into dist/, and CI
    // builds before it tests. Without this, every test is collected twice.
    include: ["test/**/*.test.ts"],
  },
});
