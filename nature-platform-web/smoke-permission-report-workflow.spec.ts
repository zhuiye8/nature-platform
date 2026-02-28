/**
 * @input Playwright page APIs with running frontend/backend services and API-bootstrapped normal-user credentials
 * @output Smoke assertions for report-chain/workflow menu and route gating based on view permissions
 * @position UI regression guardrail ensuring P3 Phase2 permission rollout blocks unauthorized access paths
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
  await page.locator("input").first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("button.primary-btn").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("normal user cannot see or open report-chain/workflow pages without view permissions", async ({ page, request }) => {
  await ensureNormalUser(request);
  await loginAs(page, "normal", "normal123");

  const hiddenMenus = [
    "待办审批",
    "质量审核",
    "技术审核",
    "内容审核",
    "编制分配",
    "报告编制",
    "最终审核",
    "材料归档"
  ];
  for (const label of hiddenMenus) {
    await expect(page.locator(".sidebar-wrap").getByText(label, { exact: true })).toHaveCount(0);
  }

  const blockedPaths = [
    "/workflow",
    "/quality-reviews",
    "/report-tech-reviews",
    "/report-content-reviews",
    "/report-compile-assignments",
    "/report-compile-submissions",
    "/report-final-reviews",
    "/material-archives"
  ];
  for (const path of blockedPaths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});
