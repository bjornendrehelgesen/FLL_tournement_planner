import { expect, test } from "@playwright/test";

test("shows the app header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("FLL Tournament Planner")).toBeVisible();
});
