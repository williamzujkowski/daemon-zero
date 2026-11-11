# Testing

## Layers

| Layer | Tool | Where | Runs in |
|---|---|---|---|
| Content validation | Zod + integrity checks | `scripts/validate-content.ts`, `tests/content.spec.ts` | `make validate`, `make test` |
| Engine unit tests | Vitest | `tests/*.spec.ts` | `make test` (with coverage thresholds) |
| Balance simulation | headless bot | `src/engine/sim/`, `scripts/run-sim.ts`, `tests/sim.spec.ts` | `make sim`, `make test` |
| M1 shell smoke test | Vitest + React DOM server / React Native Web | `tests/app.spec.ts` | `make test` |
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

`make verify-full`: typecheck, lint, content validation, tests with coverage, balance sim, production web export, dependency audit, secret scan, vulnerability scan, SBOM. E2E is added to CI in M5.

## M1 shell verification

`make verify` includes `make build-web`. The shell imports the real content and
public engine API and displays the oldest initial log entry (the engine stores
logs newest first). `tests/app.spec.ts` renders the actual root through React
Native Web and checks that it shows this entry without the second boot line.
Vitest aliases `react-native` to `react-native-web` only in its own resolver;
Metro uses the real native package for Android.

Coverage includes `App.tsx` and `src/**/*.{ts,tsx}`. All original global
thresholds remain in force (90% lines/functions/statements, 80% branches), with
additional 80% floors for `src/app` and `src/ui`.

To inspect the production web export:

```bash
make build-web
python3 -m http.server 8088 --directory dist
```

Open `http://localhost:8088` and confirm that `BOOT_SEQ` appears on black. Check
both desktop and narrow viewports and the browser console. This exploratory
check does not introduce the M5 E2E suite.

### Android with Expo Go

On Ubuntu x86_64, install the JDK, SDK and KVM prerequisites:

```bash
bash scripts/bootstrap-ubuntu24.sh --android
. "$HOME/.config/daemon-zero/android-env.sh"
emulator -accel-check
sdkmanager --sdk_root="$ANDROID_HOME" 'system-images;android-36;google_apis;x86_64'
avdmanager create avd --name daemon-zero-m1 --package 'system-images;android-36;google_apis;x86_64' --device pixel_7
emulator -avd daemon-zero-m1 -no-window -no-audio -no-snapshot -gpu swiftshader_indirect
```

Use a different AVD name if that one already exists. In another shell, source
the environment file and run `make android`. Expo installs/opens the compatible
Expo Go client and loads the project. `make dev` starts the same server without
opening a platform; `make web` opens its web client.

Confirm the app, not just the emulator, boots:

```bash
adb shell getprop sys.boot_completed
adb shell uiautomator dump /sdcard/daemon-zero-m1.xml
adb pull /sdcard/daemon-zero-m1.xml /tmp/daemon-zero-m1.xml
adb exec-out screencap -p > /tmp/daemon-zero-m1.png
```

The property should be `1`; the UI hierarchy should contain resource id
`boot-log` and the `BOOT_SEQ` line. Inspect the screenshot for the black screen
and readable text. This verifies the development app in Expo Go, not a signed
standalone Android build (M6). SDK tools may print upstream deprecation notices
for `sdkmanager` and `avdmanager`; their replacements are outside this milestone.

The bootstrap pins the Temurin 21 patch in mise, verifies the command-line tools
archive against Google's SHA-256, and installs platform `android-37.0` and build
tools `37.0.0` for the SDK 58 / React Native 0.88 toolchain. The API 36 system
image is installed separately for the emulator test. Tool paths and Android
licenses stay outside the repo. `--android` accepts the SDK licenses; the default
bootstrap does not install the SDK or KVM packages. The pinned JDK is part of the
common mise toolchain.
