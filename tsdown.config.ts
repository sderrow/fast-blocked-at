import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: true,
  outDir: "dist",
  clean: true,
  minify: false,
  sourcemap: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
