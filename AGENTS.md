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
- Prefer inferred return types for functions unless an explicit annotation materially improves API contracts or readability.
- Avoid `unknown` when a concrete generic bound can model expected shapes (for example `<T extends { bbox: BoundingBox }>` in geometry pipelines).
- Reuse shared option-resolution helpers (for example `resolveWithDefaults`) instead of repeating inline default spread patterns.

## Complexity conventions (Biome)
- Keep functions under Biome cognitive complexity limits (`lint/complexity/noExcessiveCognitiveComplexity`).
- When refactoring for complexity, extract helpers only when they represent a real domain concept (metrics building, break-signal evaluation, option resolution), not trivial wrappers.
- Prefer a small orchestration function plus focused predicate/metric helpers over one large conditional block.
- Validate complexity cleanup with targeted checks:
  - `bunx biome check src --max-diagnostics=5000 | rg noExcessiveCognitiveComplexity`

## TDD + regression workflow
- Follow strict TDD order for algorithm changes:
  1. Add failing unit test for the specific regression/edge case.
  2. Implement minimal fix.
  3. Re-run focused tests, then full suite.
- For paragraph detection work, prioritize `src/utils/marking.test.ts` + `src/utils/paragraphs.test.ts` before running full `bun test`.
- Snapshot policy is strict:
  - Never run `WRITE_SNAPSHOTS=true` unless maintainer explicitly requests it.
  - Treat any snapshot diff as regression until proven otherwise against source image/layout evidence.

## Performance and scale guardrails
- Assume workloads can reach 10k+ page equivalent batches; avoid adding per-line expensive recomputation inside hot loops.
- Prefer robust statistics that are computed once per batch (percentiles/medians) and reused.
- Keep an eye on allocation churn in tight loops; extract reusable metrics outside per-item decisions.

## Practical repo pitfalls
- `bun run lint` may fail on existing repo-wide formatting/style issues unrelated to your change. Do not mass-reformat fixture JSON or unrelated files unless explicitly requested.
- If lint failures are unrelated, still run and report:
  - `bun test`
  - `bun run build`
  - targeted Biome checks for touched files/rules.
- Keep demo app changes (`demo/`) isolated from core algorithm work unless task explicitly spans both.

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
