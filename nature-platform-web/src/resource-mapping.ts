/**
 * @input Legacy permission code checks from existing pages/routes and canonical page resource keys
 * @output resolveResourceKey() mapper that normalizes permission-style codes into page-level RBAC resource keys
 * @position Frontend compatibility adapter bridging historical v-permission usage to resource-based authorization model
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
const exactMap: Record<string, string> = {
  "workflow-task:view": "page.workflow",
  "workflow-task:approve": "page.workflow",
  "workflow-task:reject": "page.workflow",
  "user:manage": "page.admin-users",
  "role:manage": "page.admin-roles",
  "permission:view": "page.admin-resources",
  "workflow:manage": "page.admin-workflow",
  "workflow-node-rule:manage": "page.admin-workflow",
  "audit:view": "page.admin-audit-logs",
  "department:manage": "page.admin-departments",
  "dingtalk:sync": "page.admin-departments"
};

export function resolveResourceKey(permissionOrResourceCode: string): string {
  const normalized = `${permissionOrResourceCode || ""}`.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "page.contracts") {
    return "page.contract-submissions";
  }
  if (normalized.startsWith("page.") || normalized.startsWith("group.")) {
    return normalized;
  }
  if (exactMap[normalized]) {
    return exactMap[normalized];
  }
  if (normalized.startsWith("customer:")) {
    return "page.customers";
  }
  if (normalized.startsWith("contract:")) {
    if (normalized === "contract:archive") {
      return "page.contract-archives";
    }
    return "page.contract-submissions";
  }
  if (normalized.startsWith("project-register:")) {
    return "page.project-registers";
  }
  if (normalized.startsWith("police-register:")) {
    return "page.police-registers";
  }
  if (normalized.startsWith("on-site-assessment:")) {
    return "page.on-site-assessments";
  }
  if (normalized.startsWith("report-tech-review:")) {
    return "page.report-tech-reviews";
  }
  if (normalized.startsWith("report-content-review:")) {
    return "page.report-content-reviews";
  }
  if (normalized.startsWith("report-compile-assignment:")) {
    return "page.report-compile-assignments";
  }
  if (normalized.startsWith("report-compile-submission:")) {
    return "page.report-compile-submissions";
  }
  if (normalized.startsWith("report-final-review:")) {
    return "page.report-final-reviews";
  }
  if (normalized.startsWith("material-archive:")) {
    return "page.material-archives";
  }
  return normalized;
}
