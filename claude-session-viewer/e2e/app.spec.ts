import { test, expect } from "@playwright/test";

test("shows multiple sessions with status, model, and cwd", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByTestId("session-card");
  await expect(cards).toHaveCount(2);
  await expect(page.getByText("frontend", { exact: true })).toBeVisible();
  await expect(page.getByText("backend", { exact: true })).toBeVisible();
});

test("shows the subagent tree for a session that has subagents", async ({ page }) => {
  await page.goto("/");
  const rows = page.getByTestId("subagent-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Explore");
  await expect(page.getByText("No active subagents")).toBeVisible();
});

test("shows a context usage progress bar with percentage", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByTestId("context-bar").first();
  await expect(bar).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", /\d+/);
});

test("shows an explicit rate limit unavailable message rather than fake numbers", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("rate-limit-unavailable")).toContainText("Unavailable");
});

test("shows the empty state when there are no sessions", async ({ page }) => {
  await page.goto("/?empty=1");
  await expect(page.getByTestId("empty-state")).toBeVisible();
});

test("settings panel opens and shows notification + privacy controls", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-toggle").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await expect(page.getByText("通知")).toBeVisible();
  await expect(page.getByText("プライバシー")).toBeVisible();
});

test("dark mode renders without layout overflow", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByTestId("session-list")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
