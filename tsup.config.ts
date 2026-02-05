import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2020",
  outDir: "dist",
  sourcemap: true,
  clean: false,
  dts: true,
  splitting: false,
  treeshake: true,
  minify: false
});
