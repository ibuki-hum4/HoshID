import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react@7 crashes on ESLint 10 when it tries to auto-detect
    // the React version through the removed context API. Declaring it skips
    // that path entirely.
    settings: { react: { version: "19.3.0" } },
  },
  // Overrides the default ignores of eslint-config-next, so they have to be
  // repeated here.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "components/ui/**",
    "drizzle/**",
  ]),
]);

export default eslintConfig;
