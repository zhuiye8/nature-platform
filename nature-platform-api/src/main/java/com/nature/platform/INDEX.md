<!-- FORMAT-DOC: Update when files in this folder change -->

# platform

Backend domain folder containing API controllers, services, configs, security, workflow, and node-stage contracts.

## Files

| File | Role | Responsibilities |
|---|---|---|
| AdminAccessService.java | Service | 统一将 legacy permission 映射到 page resource，并执行角色资源鉴权与当前用户资源聚合 |
| AdminAuditLogController.java | Controller | Exposes admin audit log query endpoint with filter parameters |
| AdminAuditLogRecord.java | Model | Defines admin audit log read model |
| AdminAuditService.java | Service | Persists and queries admin operation audit entries |
| AdminResourceController.java | Controller | Exposes resource catalog list/tree CRUD and role-resource assignment APIs |
| AdminResourceCreateRequest.java | Model | Defines create-resource request payload contract |
| AdminResourceRecord.java | Model | Defines resource read model for flat list and tree responses |
| AdminResourceService.java | Service | Implements resource catalog CRUD, role-resource binding, and user-scoped menu-tree projection |
| AdminResourceUpdateRequest.java | Model | Defines update-resource request payload contract |
| AdminPermissionCodes.java | Model | Defines permission-code constants for admin management module |
| AdminPermissionController.java | Controller | Exposes permission catalog query/create/update/delete/sync endpoints for management UI |
| AdminPermissionCreateRequest.java | Model | Defines permission-create payload contract |
| AdminPermissionRecord.java | Model | Defines permission dictionary read model |
| AdminPermissionService.java | Service | Implements permission dictionary CRUD and built-in permission sync orchestration |
| AdminPermissionUpdateRequest.java | Model | Defines permission-update payload contract |
| AdminRoleController.java | Controller | Exposes role CRUD, role-user assignment, and role-resource assignment management endpoints |
| AdminRoleRecord.java | Model | Defines role read model with canonical resource keys and compatibility permission alias |
| AdminRoleResourceAssignRequest.java | Model | Defines role-resource replacement payload contract |
| AdminRoleService.java | Service | Implements role lifecycle plus role-resource and role-user binding persistence |
| AdminRoleUpsertRequest.java | Model | Defines role create/update payload contract with resourceKeys |
| AdminRoleUserAssignRequest.java | Model | Defines role-user assignment payload for replacing usernames by role |
| AdminRoleUserOptionRecord.java | Model | Defines role assignment candidate user row for transfer selector |
| AdminUserController.java | Controller | Exposes user list/create/update management endpoints and role-code options |
| AdminUserCreateRequest.java | Model | Defines create-user request payload contract |
| AdminUserRecord.java | Model | Defines user read model with role bindings |
| AdminUserService.java | Service | Implements user account lifecycle, role assignment, and super-admin safety checks |
| AdminUserUpdateRequest.java | Model | Defines update-user request payload contract |
| AdminWorkflowController.java | Controller | Exposes workflow definition and node-rule management endpoints |
| BusinessPermissionCodes.java | Model | Defines business permission constants for core pages, report chain, material archive, and workflow task actions |
| BuiltInPermissionRegistry.java | Component | Declares system built-in permission catalog in Chinese metadata for auto-sync |
| BuiltInPermissionSpec.java | Model | Defines immutable built-in permission descriptor for registry and sync operations |
| AuthController.java | Controller | Exposes login, DingTalk callback/url, and current-user role/resource/menu profile endpoints |
| AuthService.java | Service | Issues login tokens and assembles current-user role/resource/menu bootstrap profile |
| ContractController.java | Controller | Exposes contract CRUD plus submission-list/archive-list and review/archive endpoints with action-level permission guards |
| ContractService.java | Service | Implements contract query/create/update/delete, submit-review flow, and archive-stage transitions |
| CustomerController.java | Controller | Exposes customer CRUD endpoints with action-level permission guards |
| CustomerRequest.java | Model | Defines mandatory customer write payload contract (except optional remark) |
| FileAssetController.java | Controller | Exposes file upload and task-scoped direct-download URL endpoint with attachment归属校验 |
| OnSiteAssessmentController.java | Controller | Exposes node-8 assessment endpoints with view/save/assign/submit permission guards |
| OnSiteAssessmentRecord.java | Model | Defines node-8 on-site assessment read model with reviewer assignment aliases and rectification metadata |
| OnSiteAssessmentService.java | Service | Implements node-8 save/submit flow with rectification-aware routing and resolves report-tech + content(technical/management/network) candidate pools from configurable node rules |
| PoliceRegisterController.java | Controller | Exposes node-7 police-register endpoints with view/save/submit permission guards |
| ProjectRegisterController.java | Controller | Exposes project-register CRUD/contract-options/submit/trace endpoints with action-level permission guards |
| PermissionSyncProperties.java | Config | Defines startup permission auto-sync feature flags from app.permission namespace |
| PermissionResourceResolver.java | Utility | Maps legacy permission/action codes to canonical page resource keys for authorization compatibility |
| PermissionSyncService.java | Service | Synchronizes built-in permissions and default role grants into IAM tables |
| PermissionSyncStartupRunner.java | Component | Triggers built-in permission auto-sync on application startup |
| QualityReviewAssignmentRequest.java | Model | Defines reviewer-assignment payload contract for technical/management/network compatibility |
| QualityReviewController.java | Controller | Exposes quality-review list/detail/candidate/assign/submit endpoints with action-level permission guards |
| QualityReviewRecord.java | Model | Defines quality-review read model with content reviewer alias fields |
| QualityReviewService.java | Service | Implements quality-review assignment/submit/task operations with content role taxonomy mapping |
| ReportTechReviewController.java | Controller | Exposes report tech-review list/detail/candidate/save endpoints with action-level permission guards |
| ReportTechReviewRecord.java | Model | Defines report tech-review read model with raw apply/task status and unified displayStatus |
| ReportTechReviewService.java | Service | Implements node-11 tech-review save/auto-submit orchestration, auto-creates node-12 content-review tasks after approve, and projects unified displayStatus |
| ReportContentReviewController.java | Controller | Exposes report content-review list/detail endpoints with action-level permission guards |
| ReportContentReviewRecord.java | Model | Defines report content-review read model with technical/management/network aliases and unified displayStatus |
| ReportContentReviewService.java | Service | Implements node-12 content-review task creation/approval/rejection orchestration with displayStatus aggregation |
| ReportContentReviewTaskRecord.java | Model | Defines report content-review task projection model |
| ReportCompileAssignmentController.java | Controller | Exposes report compile-assignment list/detail/candidate/save/submit endpoints with action-level permission guards |
| ReportCompileSubmissionController.java | Controller | Exposes report compile-submission list/detail/save/submit endpoints with action-level permission guards |
| ReportCompileService.java | Service | Implements report compile assignment/upload stages and auto-creates final-review tasks when reviewer is configured |
| ReportFinalReviewController.java | Controller | Exposes report final-review list/detail/candidate/save endpoints with action-level permission guards |
| ReportFinalReviewRecord.java | Model | Defines report final-review read model with raw apply/task status and unified displayStatus |
| ReportFinalReviewService.java | Service | Implements node-15 final-review save/auto-submit orchestration plus task approve/reject operations and displayStatus projection |
| MaterialArchiveController.java | Controller | Exposes material-archive list/detail/save/submit endpoints with action-level permission guards |
| ProcessOverviewController.java | Controller | Exposes read-only `/api/v1/process-overview/{projectId}` aggregate endpoint for cross-node workflow snapshots |
| ProcessOverviewRecord.java | Model | Defines full-process current-state read model with node sections and attachment filename summaries |
| ProcessOverviewService.java | Service | Aggregates project-node detail records (node 5-16) into one overview payload for process detail page |
| NaturePlatformApplication.java | Entry | Bootstraps backend runtime and enables permission-sync configuration properties |
| UserAccountService.java | Service | Provides user and role lookup plus enabled-user filtering for assignment and authorization flows |
| WorkflowController.java | Controller | Exposes workflow-task todo/contract-review-detail/approve/reject endpoints with action-level permission guards |
| WorkflowTaskDto.java | Model | Defines workflow-task read model with raw status plus unified displayStatus for task-center rendering |
| WorkflowTaskService.java | Service | Aggregates cross-domain todo tasks, enforces task-access guard, and provides contract review detail with unified displayStatus/currentNode |
| WorkflowConfigService.java | Service | Manages workflow definition/node-rule data (with stage-option validation) and provides runtime role resolution by node slot |
| WorkflowDefinitionRecord.java | Model | Defines workflow definition read model |
| WorkflowDefinitionUpsertRequest.java | Model | Defines workflow definition write payload |
| WorkflowNodeRuleItemRecord.java | Model | Defines node-rule item read model |
| WorkflowNodeRuleItemRequest.java | Model | Defines node-rule item write payload |
| WorkflowNodeRuleRecord.java | Model | Defines node-rule aggregate read model |
| WorkflowNodeRuleUpsertRequest.java | Model | Defines node-rule aggregate write payload |
| ResourceKeys.java | Model | Defines canonical group/page resource-key constants for RBAC and menu projection |
