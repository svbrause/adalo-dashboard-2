import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("app loads and shows login or dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/./);
    // Login screen has "Access Dashboard" button; dashboard has nav/sidebar. Wait for app shell.
    await expect(
      page.getByRole("button", { name: "Access Dashboard" }).or(
        page.getByRole("link", { name: /clients|leads/i }).first()
      )
    ).toBeVisible({ timeout: 15000 });
  });

  test("standalone skin quiz page loads", async ({ page }) => {
    await page.goto("/skin-quiz?r=recTest&t=Patients");
    await expect(page).toHaveTitle(/./);
    // Quiz intro or first question
    await expect(
      page.getByText(/skin|quiz|start|question/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
