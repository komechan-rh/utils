import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Some sandboxed dev containers pre-install a specific Chromium revision
// that doesn't match the revision @playwright/test expects, under
// $PLAYWRIGHT_BROWSERS_PATH/chromium-<rev>/chrome-linux/chrome. Use it only
// when present; a normal machine with `playwright install` already run
// falls through to Playwright's own browser resolution.
function sandboxChromiumPath(): string | undefined {
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersPath) return undefined;
  const versionedDirs = ["chromium-1194", "chromium"];
  for (const dir of versionedDirs) {
    const candidate = `${browsersPath}/${dir}/chrome-linux/chrome`;
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * These E2E tests drive the built React UI in a real browser (Chromium),
 * outside of Tauri, using the in-browser mock data path (see
 * src/lib/mockData.ts) since a real macOS window + tray is not something
 * this environment (or CI in general) can drive. They cover the same UI
 * assertions the spec's "UI test" section asks for; Tauri-specific behavior
 * (tray title, native notifications, hooks wiring) is covered instead by
 * the Rust unit/integration tests and documented as manually verified on
 * macOS in README.md "既知の制約".
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: sandboxChromiumPath(),
        },
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
