/**
 * @input Playwright page APIs plus on-site assessment frontend route and backend list/candidate APIs
 * @output Smoke assertions for node-8 page availability, reviewer assignment dropdown binding, and incomplete-submit blocking
 * @position UI smoke test case ensuring critical on-site assessment entrypoint is reachable and assignment guardrails are effective
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  const usernameInput = page.locator(".login-card input").first();
  const passwordInput = page.locator('.login-card input[type="password"]').first();
  await usernameInput.fill("admin");
  await passwordInput.fill("admin123");
  await page.locator(".login-card .el-button--primary").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function chooseSelectValue(
  page: Page,
  dialog: Locator,
  selectIndex: number,
  value: string
): Promise<void> {
  await dialog.locator(".el-select").nth(selectIndex).click();
  const dropdown = page.locator(".el-select-dropdown:visible").last();
  await expect(dropdown).toBeVisible();
  await dropdown.getByText(value, { exact: true }).click();
}

test("on-site assessment page is reachable and refreshable", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/on-site-assessments");
  await expect(page).toHaveURL(/\/on-site-assessments$/);

  const refreshButton = page.locator(".page-header .el-button").first();
  await expect(refreshButton).toBeVisible();
  await refreshButton.click();

  await expect(page.locator(".tip-card .el-alert")).toBeVisible();
  await expect(page.locator(".el-table")).toBeVisible();
});

test("assignment dialog binds four pools and blocks incomplete save", async ({ page }) => {
  const mockRows = [
    {
      projectRegisterId: 990001,
      applicationName: "e2e-onsite-assignment",
      status: "DRAFT",
      packageObjectKey: "e2e/demo.zip",
      techReviewer: "",
      contentReviewerA: "",
      contentReviewerB: "",
      contentReviewerC: "",
      assignmentVersionNo: 0,
      workflowNode: "ON_SITE_ASSESSMENT",
      workflowStatus: "IN_PROGRESS"
    }
  ];
  const mockCandidates = {
    techReviewers: ["tech-user-1", "tech-user-2"],
    contentReviewersA: ["content-a-1", "content-a-2"],
    contentReviewersB: ["content-b-1", "content-b-2"],
    contentReviewersC: ["content-c-1", "content-c-2"]
  };
  const assignmentRequests: string[] = [];

  await page.route("**/api/v1/on-site-assessments/reviewer-candidates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "OK", message: "ok", data: mockCandidates })
    });
  });
  await page.route("**/api/v1/on-site-assessments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "OK", message: "ok", data: mockRows })
    });
  });
  await page.route("**/api/v1/on-site-assessments/*/review-assignment", async (route) => {
    assignmentRequests.push(route.request().postData() ?? "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        message: "ok",
        data: {
          ...mockRows[0],
          techReviewer: "tech-user-1",
          contentReviewerA: "content-a-1",
          contentReviewerB: "content-b-1",
          contentReviewerC: "content-c-1",
          assignmentVersionNo: 1
        }
      })
    });
  });

  await loginAsAdmin(page);
  await page.goto("/on-site-assessments");
  await expect(page).toHaveURL(/\/on-site-assessments$/);
  await expect(page.locator(".el-table")).toBeVisible();
  await expect(page.getByText("e2e-onsite-assignment", { exact: true })).toBeVisible();

  const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
  await firstRow.locator("button").nth(1).click();
  const dialog = page.locator(".el-dialog:visible").last();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".el-select")).toHaveCount(4);

  await dialog.locator(".el-select").nth(0).click();
  let dropdown = page.locator(".el-select-dropdown:visible").last();
  await expect(dropdown.getByText("tech-user-1", { exact: true })).toBeVisible();
  await expect(dropdown.getByText("tech-user-2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await dialog.locator(".el-select").nth(1).click();
  dropdown = page.locator(".el-select-dropdown:visible").last();
  await expect(dropdown.getByText("content-a-1", { exact: true })).toBeVisible();
  await expect(dropdown.getByText("content-a-2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await dialog.locator(".el-select").nth(2).click();
  dropdown = page.locator(".el-select-dropdown:visible").last();
  await expect(dropdown.getByText("content-b-1", { exact: true })).toBeVisible();
  await expect(dropdown.getByText("content-b-2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await dialog.locator(".el-select").nth(3).click();
  dropdown = page.locator(".el-select-dropdown:visible").last();
  await expect(dropdown.getByText("content-c-1", { exact: true })).toBeVisible();
  await expect(dropdown.getByText("content-c-2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await chooseSelectValue(page, dialog, 0, "tech-user-1");
  await dialog.locator(".el-dialog__footer .el-button--primary").click();
  await page.waitForTimeout(300);
  await expect(page.locator(".el-message--warning").last()).toBeVisible();
  await expect.poll(() => assignmentRequests.length).toBe(0);

  await chooseSelectValue(page, dialog, 1, "content-a-1");
  await chooseSelectValue(page, dialog, 2, "content-b-1");
  await chooseSelectValue(page, dialog, 3, "content-c-1");
  await dialog.locator(".el-dialog__footer .el-button--primary").click();

  await expect.poll(() => assignmentRequests.length).toBe(1);
  await expect(assignmentRequests[0]).toContain('"techReviewer":"tech-user-1"');
  await expect(assignmentRequests[0]).toContain('"contentReviewerA":"content-a-1"');
  await expect(assignmentRequests[0]).toContain('"contentReviewerB":"content-b-1"');
  await expect(assignmentRequests[0]).toContain('"contentReviewerC":"content-c-1"');
});
