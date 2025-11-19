# Agent Handbook

## Tooling
- Run builds with `bun run build`, which shells out to the published `tsdown` CLI (esbuild + declaration emit).
- Format/lint via `bun run lint`, which invokes the workspace Biome binary.
- Execute tests with `bun test` (or `bun run test` for coverage flags).

## Testing expectations
- Keep the snapshot tests in `src/index.test.ts` passing. Use `WRITE_SNAPSHOTS=true` only when intentionally refreshing fixtures.
- Additional focused tests live under `src/utils`. Follow the `bun:test` style used in the repo.

## Code style
- TypeScript uses 4-space indentation and ESM modules. Respect the path alias `@/` that resolves to `src/`.
- Prefer explicit helper functions with JSDoc blocks when adding new utilities.

## Bundler + linting internals
- `tsdown` and Biome are installed from npm—no local shims remain. Update their configuration files (`tsconfig.json`, `biome.json`) when workflows need new capabilities.
- Output artifacts must continue to land in `dist/` as `index.js`, `index.js.map`, and declaration files.

## Dependency management
- Network access to npm may be restricted. When updating dependencies, prefer editing `package.json`/`bun.lock` directly and ensure scripts keep working with the installed CLIs.
