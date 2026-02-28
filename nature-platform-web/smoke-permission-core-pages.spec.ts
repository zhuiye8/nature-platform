/**
 * @input Playwright page APIs with running frontend/backend services and real login credentials
 * @output Smoke assertions for core business-page route/menu gating based on permissions
 * @position UI smoke guardrail for permission-driven visibility and redirect behavior on core pages
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { expect, test, type Page } from "@playwright/test";

async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("input").first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("button.primary-btn").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("reviewer cannot see or open core business pages without view permissions", async ({ page }) => {
  await loginAs(page, "reviewer", "review123");

  const hiddenMenus = ["客户管理", "合同提审", "合同归档", "项目登记", "公安登记", "现场测评"];
  for (const label of hiddenMenus) {
    await expect(page.locator(".sidebar-wrap").getByText(label, { exact: true })).toHaveCount(0);
  }

  const blockedPaths = [
    "/customers",
    "/contract-submissions",
    "/contract-archives",
    "/project-registers",
    "/police-registers",
    "/on-site-assessments"
  ];
  for (const path of blockedPaths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});
