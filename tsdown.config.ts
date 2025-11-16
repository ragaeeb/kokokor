import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    outDir: "dist",
    sourcemap: true,
    clean: true,
    target: "node22",
    platform: "node",
    outExtensions: () => ({
        js: ".js",
        dts: ".d.ts",
    }),
});
