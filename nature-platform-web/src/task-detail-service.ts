/**
 * @input Workflow task type/value conventions and router path composition requirements
 * @output Task-detail route helpers for unified detail-page navigation across workflow and review pages
 * @position Frontend navigation utility layer for normalized task-type routing
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
export type WorkflowTaskType =
  | "CONTRACT"
  | "PROJECT_REGISTER"
  | "QUALITY_REVIEW"
  | "REPORT_TECH_REVIEW"
  | "REPORT_CONTENT_REVIEW"
  | "REPORT_FINAL_REVIEW"
  | string;

export function normalizeTaskType(taskType: string | undefined): WorkflowTaskType {
  if (!taskType) {
    return "";
  }
  return taskType.trim().toUpperCase();
}

export function isProjectWorkflowTask(taskType: string | undefined): boolean {
  const normalized = normalizeTaskType(taskType);
  return (
    normalized === "PROJECT_REGISTER" ||
    normalized === "QUALITY_REVIEW" ||
    normalized === "REPORT_TECH_REVIEW" ||
    normalized === "REPORT_CONTENT_REVIEW" ||
    normalized === "REPORT_FINAL_REVIEW"
  );
}

export function toTaskDetailPath(
  taskType: string,
  bizId: number,
  taskId?: string
): string {
  const normalizedType = normalizeTaskType(taskType);
  const params = new URLSearchParams();
  if (taskId && taskId.trim()) {
    params.set("taskId", taskId.trim());
  }
  const query = params.toString();
  return `/task-detail/${encodeURIComponent(normalizedType)}/${bizId}${query ? `?${query}` : ""}`;
}

