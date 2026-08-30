import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    ".claude/**",
    ".pnpm-store/**",
    "vibehard-LLM/**",
    // 第三方静态镜像资源（zutils 工具集），无需 lint:
    "public/zutils/**",
  ]),
]);

export default eslintConfig;
