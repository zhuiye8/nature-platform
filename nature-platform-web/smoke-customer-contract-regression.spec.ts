/**
 * @input Playwright page APIs, frontend routes /customers and /contract-submissions, mocked customer/contract HTTP responses
 * @output Smoke regression assertion for 403 feedback visibility and empty default customer selector in contract create dialog
 * @position UI regression guardrail for customer create permission error handling and contract form initialization correctness
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { expect, test, type Page, type Route } from "@playwright/test";

async function bootstrapAdminSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("nature-platform-token", "playwright-token");
    localStorage.setItem("nature-platform-roles", JSON.stringify(["ROLE_SUPER_ADMIN"]));
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function selectAnyRegion(page: Page, dialog: ReturnType<Page["locator"]>) {
  await dialog.getByPlaceholder("请选择省/市/区").click();
  const dropdown = page.locator(".el-cascader__dropdown:visible");
  await dropdown.locator(".el-cascader-menu").nth(0).locator(".el-cascader-node:not(.is-disabled)").first().click();
  await dropdown.locator(".el-cascader-menu").nth(1).locator(".el-cascader-node:not(.is-disabled)").first().click();
  await dropdown.locator(".el-cascader-menu").nth(2).locator(".el-cascader-node:not(.is-disabled)").first().click();
}

test("customer 403 shows feedback and contract customer selector defaults to empty", async ({ page }) => {
  const postRequests: string[] = [];
  const customers = [
    {
      id: 9527,
      fullName: "playwright-customer-seed",
      contactName: "seed-contact",
      mobilePhone: "13800001111",
      region: "浙江省/杭州市/西湖区",
      createdBy: "admin",
      createdAt: "2026-02-25 00:00:00"
    }
  ];

  await page.route("**/api/v1/customers", async (route: Route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ code: "OK", message: "ok", data: customers })
      });
      return;
    }
    if (method === "POST") {
      postRequests.push(route.request().postData() ?? "");
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ code: "FORBIDDEN", message: "当前账号无权限执行该操作" })
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/v1/contracts", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ code: "OK", message: "ok", data: [] })
      });
      return;
    }
    await route.fallback();
  });

  await bootstrapAdminSession(page);

  await page.goto("/customers");
  await expect(page).toHaveURL(/\/customers$/);
  await page.locator(".page-header .el-button--primary").click();
  const customerDialog = page.locator(".el-dialog:visible").last();
  await expect(customerDialog).toBeVisible();

  await customerDialog.getByPlaceholder("请输入客户全称").fill("playwright-customer-create-403");
  await customerDialog.getByPlaceholder("请输入统一社会信用代码").fill("91330100MA12345678");
  await customerDialog.getByPlaceholder("请输入联系人").fill("王测试");
  await customerDialog.getByPlaceholder("请输入联系电话").fill("13800138000");
  await customerDialog.getByPlaceholder("请输入客户行业").fill("信息技术服务");
  await selectAnyRegion(page, customerDialog);
  await customerDialog.getByPlaceholder("请输入详细地址（街道/门牌号）").fill("文三路 188 号");
  await customerDialog.locator(".el-dialog__footer .el-button--primary").click();

  await expect.poll(() => postRequests.length).toBe(1);
  await expect(page.locator(".el-message--error").last()).toContainText("当前账号无权限执行该操作");

  await customerDialog.locator(".el-dialog__footer .el-button").first().click();
  await expect(customerDialog).not.toBeVisible();

  await page.goto("/contract-submissions");
  await expect(page).toHaveURL(/\/contract-submissions$/);
  await page.locator(".page-header .el-button--primary").click();
  const contractDialog = page.locator(".el-dialog:visible").last();
  await expect(contractDialog).toBeVisible();
  const customerCombobox = contractDialog.getByRole("combobox").first();
  await expect(customerCombobox).toBeVisible();
  await expect(customerCombobox).toHaveValue("");
  await expect(customerCombobox).not.toHaveValue("0");
});
