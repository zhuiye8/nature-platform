/**
 * @input Business-module permission semantics for core pages, quality/report chain, material archive, and workflow task actions
 * @output BusinessPermissionCodes resource:action constants shared by business/report/workflow controllers and seed migrations
 * @position Authorization vocabulary layer for non-admin workflow endpoints across business and report domains
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public final class BusinessPermissionCodes {
  public static final String CUSTOMER_VIEW = "customer:view";
  public static final String CUSTOMER_CREATE = "customer:create";
  public static final String CUSTOMER_UPDATE = "customer:update";
  public static final String CUSTOMER_DELETE = "customer:delete";

  public static final String CONTRACT_VIEW = "contract:view";
  public static final String CONTRACT_CREATE = "contract:create";
  public static final String CONTRACT_UPDATE = "contract:update";
  public static final String CONTRACT_SUBMIT = "contract:submit";
  public static final String CONTRACT_ARCHIVE = "contract:archive";
  public static final String CONTRACT_DELETE = "contract:delete";

  public static final String PROJECT_REGISTER_VIEW = "project-register:view";
  public static final String PROJECT_REGISTER_CREATE = "project-register:create";
  public static final String PROJECT_REGISTER_UPDATE = "project-register:update";
  public static final String PROJECT_REGISTER_SUBMIT = "project-register:submit";
  public static final String PROJECT_REGISTER_DELETE = "project-register:delete";
  public static final String PROJECT_REGISTER_TRACE_VIEW = "project-register:trace:view";

  public static final String POLICE_REGISTER_VIEW = "police-register:view";
  public static final String POLICE_REGISTER_SAVE = "police-register:save";
  public static final String POLICE_REGISTER_SUBMIT = "police-register:submit";

  public static final String ON_SITE_ASSESSMENT_VIEW = "on-site-assessment:view";
  public static final String ON_SITE_ASSESSMENT_SAVE = "on-site-assessment:save";
  public static final String ON_SITE_ASSESSMENT_ASSIGN = "on-site-assessment:assign";
  public static final String ON_SITE_ASSESSMENT_SUBMIT = "on-site-assessment:submit";
  public static final String ON_SITE_ASSESSMENT_CANDIDATE_VIEW = "on-site-assessment:candidate:view";

  public static final String QUALITY_REVIEW_VIEW = "quality-review:view";
  public static final String QUALITY_REVIEW_CANDIDATE_VIEW = "quality-review:candidate:view";
  public static final String QUALITY_REVIEW_ASSIGN = "quality-review:assign";
  public static final String QUALITY_REVIEW_SUBMIT = "quality-review:submit";

  public static final String REPORT_TECH_REVIEW_VIEW = "report-tech-review:view";
  public static final String REPORT_TECH_REVIEW_CANDIDATE_VIEW = "report-tech-review:candidate:view";
  public static final String REPORT_TECH_REVIEW_SAVE = "report-tech-review:save";

  public static final String REPORT_CONTENT_REVIEW_VIEW = "report-content-review:view";

  public static final String REPORT_COMPILE_ASSIGNMENT_VIEW = "report-compile-assignment:view";
  public static final String REPORT_COMPILE_ASSIGNMENT_CANDIDATE_VIEW =
      "report-compile-assignment:candidate:view";
  public static final String REPORT_COMPILE_ASSIGNMENT_SAVE = "report-compile-assignment:save";
  public static final String REPORT_COMPILE_ASSIGNMENT_SUBMIT = "report-compile-assignment:submit";

  public static final String REPORT_COMPILE_SUBMISSION_VIEW = "report-compile-submission:view";
  public static final String REPORT_COMPILE_SUBMISSION_SAVE = "report-compile-submission:save";
  public static final String REPORT_COMPILE_SUBMISSION_SUBMIT = "report-compile-submission:submit";

  public static final String REPORT_FINAL_REVIEW_VIEW = "report-final-review:view";
  public static final String REPORT_FINAL_REVIEW_CANDIDATE_VIEW = "report-final-review:candidate:view";
  public static final String REPORT_FINAL_REVIEW_SAVE = "report-final-review:save";

  public static final String MATERIAL_ARCHIVE_VIEW = "material-archive:view";
  public static final String MATERIAL_ARCHIVE_SAVE = "material-archive:save";
  public static final String MATERIAL_ARCHIVE_SUBMIT = "material-archive:submit";

  public static final String WORKFLOW_TASK_VIEW = "workflow-task:view";
  public static final String WORKFLOW_TASK_APPROVE = "workflow-task:approve";
  public static final String WORKFLOW_TASK_REJECT = "workflow-task:reject";

  private BusinessPermissionCodes() {}
}
