import js from "@eslint/js";
import ts from "typescript-eslint";

export const baseConfig = [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "react/no-unescaped-entities": "off",
    },
  },
];
