# Testing

## Layers

| Layer | Tool | Where | Runs in |
|---|---|---|---|
| Content validation | Zod + integrity checks | `scripts/validate-content.ts`, `tests/content.spec.ts` | `make validate`, `make test` |
| Engine unit tests | Vitest | `tests/*.spec.ts` | `make test` (with coverage thresholds) |
| Balance simulation | headless bot | `src/engine/sim/`, `scripts/run-sim.ts`, `tests/sim.spec.ts` | `make sim`, `make test` |
| Component tests (M3+) | Vitest + React Native Testing Library | `tests/ui/` | `make test` |
| End-to-end (M5) | Playwright against the web export | `tests/e2e/` | `make e2e` |
| Agent-driven exploratory testing | Playwright MCP | `.mcp.json` | on demand |

## Writing engine tests

- Use the helpers in `tests/helpers.ts`: `fresh()`, `rich()`, `grant(state, ...nodeIds)`, `must(result)`, `withoutDilemmas(state)`.
- Reach a game situation by calling real actions (`grant`) rather than hand-building state, so effects and logs are applied the way the game applies them.
- The engine is deterministic. Assert exact values where the maths is simple, `toBeCloseTo` for integrated quantities.
- Every new integrity rule needs a test in `tests/content.spec.ts` that corrupts the real content and proves the rule fires.

## Balance simulation

`make sim` plays the full game twice in about a second:

- **STEALTH** plays carefully and must reach victory within the gates in `src/engine/sim/gates.ts`.
- **GREEDY** ignores threats. It is expected to be wiped repeatedly; the test asserts it always recovers and keeps progressing (no soft-locks in the wipe loop).

The bot buys whatever most shortens the wait for the next tech node. It only uses public engine actions.

## End-to-end with Playwright (M5)

The web build is the E2E target because it runs the same code as native and needs no emulator.

1. Add dev dependencies with exact versions: `@playwright/test`, and `serve` (or use `npx expo start --web`). Install the browser with `npx playwright install --with-deps chromium`.
2. Build once and serve statically, which is faster and more stable than the dev server:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173', testIdAttribute: 'data-testid' },
  webServer: {
    command: 'npx expo export --platform web && npx serve dist --listen 4173 --single',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

3. Select by test id only (see `docs/UI-SPEC.md`). Do not select by text.

```ts
// tests/e2e/boot.spec.ts
import { expect, test } from '@playwright/test';

test('tick 0 is blind, and the first driver mounts the rate readout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('manual-cycle')).toBeVisible();
  await expect(page.getByTestId('widget-CYCLE_COUNTER_AND_RATE')).toHaveCount(0);
  for (let i = 0; i < 15; i++) await page.getByTestId('manual-cycle').click();
  await page.getByTestId('node-p1_clock_interrupt-unlock').click();
  await expect(page.getByTestId('widget-CYCLE_COUNTER_AND_RATE')).toBeVisible();
});
```

4. Long scenarios (a dilemma, a wipe, Phase 3) should not be reached by clicking for minutes. Add a development-only hook that loads a save code, for example `window.__daemonLoadSave(code)`, compiled out of production builds, and generate the save codes in a Node script using the engine (`exportSave(grant(...))`).
5. Each test starts from clean storage (`page.addInitScript(() => localStorage.clear())`).

Minimum E2E coverage: boot; first unlock mounts a widget; a dilemma blocks input until resolved; wipe then breadcrumb appears in the boot log; save code export and import; reload restores state.

## Agent-driven testing with Playwright MCP

`.mcp.json` registers Microsoft's Playwright MCP server (`@playwright/mcp`) so an agent can drive the running web app: navigate, click by accessibility snapshot, read the page, take screenshots.

Use it for exploratory passes ("play Phase 1 and tell me where the UI is confusing") and for verifying a milestone exit gate when no human is available. It does not replace the scripted E2E suite: anything worth checking twice belongs in `tests/e2e/`.

Start the app first (`make web`), then ask the agent to open `http://localhost:8081`.

## What CI runs

`make verify-full`: typecheck, lint, content validation, tests with coverage, balance sim, dependency audit, secret scan, vulnerability scan, SBOM. E2E is added to CI in M5.
