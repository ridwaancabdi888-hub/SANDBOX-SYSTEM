import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Node's ESM resolver requires explicit file extensions, but the app source
 * uses TypeScript's extensionless relative imports. This hook maps
 * `./foo` -> `./foo.ts` (or `./foo/index.ts`) so `node --test` can run the
 * real source files directly via type stripping — no build step, and no
 * `.ts` extensions leaking into application code.
 */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const resolved = new URL(specifier, context.parentURL);
    if (!existsSync(fileURLToPath(resolved))) {
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        const candidateUrl = new URL(candidate, context.parentURL);
        if (existsSync(fileURLToPath(candidateUrl))) {
          return nextResolve(candidate, context);
        }
      }
    }
  }
  return nextResolve(specifier, context);
}
