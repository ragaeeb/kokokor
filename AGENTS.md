# Agent Handbook

## Project map (quick orientation)
- Public entrypoint is `src/index.ts`.
- Core pipeline is:
  1. `mapObservationsToTextLines` (`src/utils/paragraphs.ts`)
  2. `mapTextLinesToParagraphs` (`src/utils/paragraphs.ts`)
  3. `formatTextBlocks` (`src/index.ts`)
- Paragraph detection internals live in `src/utils/marking.ts`.
- Main public types live in `src/types.ts`.

## API behavior (important defaults)
- Recommended high-level API is `reconstructParagraphs(input, options?)`.
- Paragraph grouping now uses the enhanced detector everywhere (legacy mode removed).
- Use object options (`ParagraphOptions`) for paragraph grouping.

## Tooling
- Run builds with `bun run build`, which shells out to the published `tsdown` CLI (esbuild + declaration emit).
- Linting uses Biome. If `bun run lint` fails with `--apply is not expected in this context`, run `bunx biome check` (or `bunx biome check --write`) and update scripts/config in a dedicated infra change.
- Execute tests with `bun test` (or `bun run test` for coverage flags).

## Testing expectations
- Keep the snapshot tests in `src/index.test.ts` passing. Use `WRITE_SNAPSHOTS=true` only when intentionally refreshing fixtures.
- Additional focused tests live under `src/utils`. Follow the `bun:test` style used in the repo.
- New synthetic perf harness is `src/utils/paragraphs.perf.test.ts` and supports `PERF_STRESS=true` for 10k-page equivalent runs.
- Treat snapshot outputs in `test/mixed/*.txt` as canonical unless maintainer explicitly approves updates.

## Current paragraph heuristics (MVP)
- Enhanced paragraph mode implements robust geometry:
  - robust width baseline (p75 with small-sample fallback)
  - robust x baseline from eligible lines
  - single-break-per-line decision to avoid vertical+indent double increments
  - short-line interaction guard
- Deferred (not MVP): weighted multi-signal scoring, multi-column handling, punctuation softening integration.

## Code style
- TypeScript uses 4-space indentation and ESM modules. Respect the path alias `@/` that resolves to `src/`.
- Prefer explicit helper functions with JSDoc blocks when adding new utilities.

## Bundler + linting internals
- `tsdown` and Biome are installed from npm—no local shims remain. Update their configuration files (`tsconfig.json`, `biome.json`) when workflows need new capabilities.
- Output artifacts must continue to land in `dist/` as `index.js`, `index.js.map`, and declaration files.

## Dependency management
- Network access to npm may be restricted. When updating dependencies, prefer editing `package.json`/`bun.lock` directly and ensure scripts keep working with the installed CLIs.

## Related docs
- Proposal: `docs/x-detect.md`
- Review synthesis: `docs/reviews/synthesis.md` and `docs/x-detect-review-synthesis.md`
- Updated implementation plan: `docs/x-detect-plan-v2.md`
- Execution checklist: `docs/plan.md`
