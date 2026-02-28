/**
 * @input Playwright page APIs with running frontend/backend and admin credentials
 * @output Smoke assertion for contract task-detail page using workflow review-detail endpoint and rendering review UI
 * @position UI regression guard for unified task-detail page contract-review path
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

test("contract task-detail uses workflow review-detail API and renders review action", async ({ page }) => {
  const contractId = 999901;
  const routeTaskId = `CONTRACT:${contractId}`;
  const contractName = "自动化合同详情检查";
  let detailRequestHit = false;

  await page.route("**/api/v1/workflow/tasks/todo**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        message: "success",
        data: [
          {
            taskId: routeTaskId,
            taskType: "CONTRACT",
            bizId: contractId,
            bizTitle: contractName,
            status: "SUBMITTED",
            displayStatus: "PENDING",
            submittedBy: "admin",
            submittedAt: "2026-02-28 12:00:00"
          }
        ],
        traceId: "",
        timestamp: "2026-02-28T12:00:00+08:00"
      })
    });
  });

  await page.route(`**/api/v1/workflow/tasks/contracts/${contractId}/detail`, async (route) => {
    detailRequestHit = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        message: "success",
        data: {
          id: contractId,
          customerId: 1,
          customerName: "自动化客户",
          projectName: "自动化项目",
          contractName,
          contractNo: "NATURE-2026-0001",
          reviewStatus: "SUBMITTED",
          archiveStatus: "DRAFT",
          createdBy: "admin",
          createdAt: "2026-02-28 12:00:00",
          remark: "回归检查",
          serviceYears: [2026],
          contractFileObjectKey: ""
        },
        traceId: "",
        timestamp: "2026-02-28T12:00:00+08:00"
      })
    });
  });

  await loginAs(page, "admin", "admin123");
  await page.goto(`/task-detail/CONTRACT/${contractId}?taskId=${encodeURIComponent(routeTaskId)}`);

  await expect(page.getByRole("heading", { name: "审核详情" })).toBeVisible();
  await expect(page.getByText("合同详情", { exact: true })).toBeVisible();
  await expect(page.getByText("审核操作", { exact: true })).toBeVisible();
  expect(detailRequestHit).toBeTruthy();
});
