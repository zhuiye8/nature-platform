/**
 * @input Playwright page APIs and running frontend/backend services for interactive login/navigation
 * @output Smoke assertions for admin login success and non-admin recycle-bin route guard behavior with API-based normal-user bootstrap
 * @position UI smoke test case set verifying auth entry and critical permission-gated route behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:18080";

async function ensureNormalUser(request: APIRequestContext): Promise<void> {
  const adminLoginResp = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { username: "admin", password: "admin123" }
  });
  expect(adminLoginResp.ok()).toBeTruthy();
  const adminLoginJson = await adminLoginResp.json();
  const adminToken = adminLoginJson?.data?.token as string | undefined;
  expect(adminToken).toBeTruthy();

  const headers = { Authorization: `Bearer ${adminToken}` };
  const listResp = await request.get(`${apiBaseUrl}/api/v1/admin/users`, { headers });
  expect(listResp.ok()).toBeTruthy();
  const listJson = await listResp.json();
  const users = (Array.isArray(listJson?.data) ? listJson.data : []) as Array<{ username?: string }>;
  const exists = users.some((item) => item?.username === "normal");

  const basePayload = {
    displayName: "普通用户",
    password: "normal123",
    enabled: true,
    roles: ["ROLE_USER"]
  };

  const upsertResp = exists
    ? await request.put(`${apiBaseUrl}/api/v1/admin/users/normal`, { headers, data: basePayload })
    : await request.post(`${apiBaseUrl}/api/v1/admin/users`, {
        headers,
        data: { username: "normal", ...basePayload }
      });
  expect(upsertResp.ok()).toBeTruthy();
}

async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  const usernameInput = page.locator("input").first();
  const passwordInput = page.locator('input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator("button.primary-btn").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("admin can login and reach dashboard nav", async ({ page }) => {
  await loginAs(page, "admin", "admin123");
  await expect(page.locator(".app-nav")).toBeVisible();
  await expect(page.locator(".app-nav .brand")).toBeVisible();
});

test("normal user is redirected when opening recycle-bin", async ({ page, request }) => {
  await ensureNormalUser(request);
  await loginAs(page, "normal", "normal123");
  await page.goto("/recycle-bin");
  await expect(page).toHaveURL(/\/dashboard$/);
});
