/**
 * @input Playwright page APIs and running frontend/backend services for interactive login/navigation
 * @output Smoke assertions for admin login success and non-admin recycle-bin restore gating visibility
 * @position UI smoke test case set verifying auth entry and critical permission-gated page behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { expect, test, type Page } from "@playwright/test";

async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  const usernameInput = page.locator(".login-card input").first();
  const passwordInput = page.locator('.login-card input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator(".login-card .el-button--primary").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("admin can login and reach dashboard nav", async ({ page }) => {
  await loginAs(page, "admin", "admin123");
  await expect(page.locator(".app-nav")).toBeVisible();
  await expect(page.locator(".app-nav .brand")).toBeVisible();
});

test("normal user sees recycle-bin warning state", async ({ page }) => {
  await loginAs(page, "normal", "normal123");
  await page.goto("/recycle-bin");
  await expect(page).toHaveURL(/\/recycle-bin$/);
  await expect(page.locator(".page-header .el-tag--warning")).toBeVisible();

  const restoreButtons = page.getByRole("button", { name: /恢复/ });
  if ((await restoreButtons.count()) > 0) {
    await expect(restoreButtons.first()).toBeDisabled();
  }
});
