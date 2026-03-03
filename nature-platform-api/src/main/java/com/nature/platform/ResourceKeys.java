/**
 * @input Route-level access design for business, report, and admin modules
 * @output ResourceKeys constants defining canonical page resource keys for RBAC checks and menu rendering
 * @position Authorization vocabulary layer for page-level resource governance across backend and frontend
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public final class ResourceKeys {
  public static final String GROUP_OVERVIEW = "group.overview";
  public static final String GROUP_BUSINESS = "group.business";
  public static final String GROUP_REPORT = "group.report";
  public static final String GROUP_SYSTEM = "group.system";

  public static final String PAGE_DASHBOARD = "page.dashboard";
  public static final String PAGE_WORKFLOW = "page.workflow";
  public static final String PAGE_CUSTOMERS = "page.customers";
  public static final String PAGE_CONTRACT_SUBMISSIONS = "page.contract-submissions";
  public static final String PAGE_CONTRACT_ARCHIVES = "page.contract-archives";
  public static final String PAGE_PROJECT_REGISTERS = "page.project-registers";
  public static final String PAGE_POLICE_REGISTERS = "page.police-registers";
  public static final String PAGE_ON_SITE_ASSESSMENT_EXECUTIONS = "page.on-site-assessment-executions";
  public static final String PAGE_ON_SITE_ASSESSMENT_RESULTS = "page.on-site-assessment-results";
  @Deprecated public static final String PAGE_ON_SITE_ASSESSMENTS = "page.on-site-assessments";
  public static final String PAGE_REPORT_TECH_REVIEWS = "page.report-tech-reviews";
  public static final String PAGE_REPORT_CONTENT_REVIEWS = "page.report-content-reviews";
  public static final String PAGE_REPORT_COMPILE_ASSIGNMENTS = "page.report-compile-assignments";
  public static final String PAGE_REPORT_COMPILE_SUBMISSIONS = "page.report-compile-submissions";
  public static final String PAGE_REPORT_FINAL_REVIEWS = "page.report-final-reviews";
  public static final String PAGE_MATERIAL_ARCHIVES = "page.material-archives";
  public static final String PAGE_ADMIN_USERS = "page.admin-users";
  public static final String PAGE_ADMIN_DEPARTMENTS = "page.admin-departments";
  public static final String PAGE_ADMIN_ROLES = "page.admin-roles";
  public static final String PAGE_ADMIN_RESOURCES = "page.admin-resources";
  public static final String PAGE_ADMIN_WORKFLOW = "page.admin-workflow";
  public static final String PAGE_ADMIN_AUDIT_LOGS = "page.admin-audit-logs";
  public static final String PAGE_RECYCLE_BIN = "page.recycle-bin";

  private ResourceKeys() {}
}
