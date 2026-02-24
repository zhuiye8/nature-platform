<!-- FORMAT-DOC: Update when files in this folder change -->

# platform

Backend domain folder containing API controllers, services, configs, security, workflow, and node-stage contracts.

## Files

| File | Role | Responsibilities |
|---|---|---|
| ApiResponse.java | Model | Defines unified success/failure API response envelope |
| AuthController.java | Controller | Exposes authentication and DingTalk callback/profile endpoints |
| AuthService.java | Service | Implements local credential login and role-aware profile assembly |
| ContractArchiveRequest.java | Model | Defines contract archive request payload |
| ContractController.java | Controller | Exposes contract CRUD/review/archive endpoints |
| ContractNumberService.java | Service | Generates contract numbers and display names |
| ContractRecord.java | Model | Defines contract read model |
| ContractRequest.java | Model | Defines contract create/update request payload |
| ContractService.java | Service | Implements contract business rules and status transitions |
| ContractSystemItemPayload.java | Model | Defines contract system-detail item payload |
| CorsConfig.java | Config | Configures cross-origin access policy |
| CurrentUser.java | Utility | Resolves current username from Spring Security context |
| CustomerController.java | Controller | Exposes customer CRUD endpoints |
| CustomerRecord.java | Model | Defines customer read model |
| CustomerRequest.java | Model | Defines customer create/update payload |
| CustomerService.java | Service | Implements customer persistence and permission rules |
| DingTalkProperties.java | Config | Defines DingTalk integration properties |
| ErrorCode.java | Model | Defines API error code enumeration (including explicit forbidden auth error code) |
| FieldChangeLogService.java | Service | Writes field-level change logs |
| FileAssetController.java | Controller | Exposes file upload endpoint (MinIO-aware) |
| GlobalExceptionHandler.java | Handler | Maps framework/runtime exceptions to standard API responses with auth status mapping |
| JsonSupport.java | Utility | Provides JSON serialization helpers for list fields |
| JwtAuthenticationFilter.java | Handler | Parses bearer token scopes and sets Spring authentication authorities |
| JwtTokenService.java | Service | Generates JWT tokens and parses username/scope claims |
| LoginRequest.java | Model | Defines login request payload |
| LoginResponse.java | Model | Defines login response payload |
| MaterialArchiveController.java | Controller | Exposes node-16 material archive list/detail/save/submit endpoints |
| MaterialArchiveRecord.java | Model | Defines node-16 material archive read model |
| MaterialArchiveRequest.java | Model | Defines node-16 material archive save payload |
| MaterialArchiveService.java | Service | Implements node-16 material archive draft/save/submit, workflow closeout, and on-site ZIP trace visibility |
| MinioConfig.java | Config | Creates MinIO client beans |
| MinioProperties.java | Config | Defines MinIO connection properties |
| NaturePlatformApplication.java | Module | Bootstraps backend runtime |
| NotificationController.java | Controller | Exposes notification list/read/delete endpoints |
| NotificationRecord.java | Model | Defines notification read model |
| NotificationService.java | Service | Implements notification persistence and fan-out creation |
| OnSiteAssessmentController.java | Controller | Exposes node-8 on-site assessment list/detail/save/reviewer-assignment/submit plus role-pool candidate endpoints |
| OnSiteAssessmentRecord.java | Model | Defines node-8 on-site assessment read model |
| OnSiteAssessmentRequest.java | Model | Defines node-8 on-site assessment save payload |
| OnSiteAssessmentService.java | Service | Implements ZIP-gated node-8 save/submit, four-reviewer assignment optimistic locking, and role-pool candidate loading |
| PoliceRegisterController.java | Controller | Exposes node-7 police register list/detail/save/submit endpoints |
| PoliceRegisterRecord.java | Model | Defines node-7 police register read model |
| PoliceRegisterRequest.java | Model | Defines node-7 police register save payload |
| PoliceRegisterService.java | Service | Implements police register persistence and next-node transition |
| ProjectRegisterController.java | Controller | Exposes project register CRUD/submit/trace endpoints |
| ProjectRegisterRecord.java | Model | Defines project register read model |
| ProjectRegisterRequest.java | Model | Defines project register create/update payload |
| ProjectRegisterService.java | Service | Implements project register CRUD/review and Flowable startup |
| ProjectSystemItemRequest.java | Model | Defines project system-detail item payload |
| ProjectWorkflowTraceService.java | Service | Provides reusable workflow-instance/action-log node transition helpers |
| QualityReviewAssignmentRequest.java | Model | Defines node-9 four-reviewer assignment payload with version lock |
| QualityReviewController.java | Controller | Exposes quality review list/detail/candidates/assignment/submit endpoints |
| QualityReviewRecord.java | Model | Defines node-9/10 aggregated quality review read model |
| QualityReviewService.java | Service | Implements node-9/10 quality review board compatibility and task review completion |
| QualityReviewTaskRecord.java | Model | Defines node-10 quality review task read model |
| RecycleBinController.java | Controller | Exposes recycle-bin query/restore endpoints |
| RecycleBinService.java | Service | Implements contract/project recycle-bin operations with super-admin restore checks |
| RecycleItemRecord.java | Model | Defines recycle-bin read model |
| ReportCompileAssignmentController.java | Controller | Exposes node-13 compile assignment list/detail/candidates/save/submit endpoints |
| ReportCompileAssignmentRecord.java | Model | Defines node-13 compile assignment read model |
| ReportCompileAssignmentRequest.java | Model | Defines node-13 compile assignment save payload |
| ReportCompileService.java | Service | Implements node-13 assignment and node-14 upload workflow transitions with on-site ZIP projection |
| ReportCompileSubmissionController.java | Controller | Exposes node-14 compile submission list/detail/save/submit endpoints |
| ReportCompileSubmissionRecord.java | Model | Defines node-14 compile submission read model |
| ReportCompileSubmissionRequest.java | Model | Defines node-14 compile submission save payload |
| ReportContentReviewController.java | Controller | Exposes node-12 content review list/detail/submit endpoints |
| ReportContentReviewRecord.java | Model | Defines node-12 content review aggregate read model |
| ReportContentReviewTaskRecord.java | Model | Defines node-12 content review task read model |
| ReportContentReviewService.java | Service | Implements node-12 A/B/C review task creation from workflow assignment and approve/reject completion |
| ReportFinalReviewController.java | Controller | Exposes node-15 final review list/detail/candidates/save/submit endpoints |
| ReportFinalReviewRecord.java | Model | Defines node-15 final review read model |
| ReportFinalReviewRequest.java | Model | Defines node-15 final review save payload |
| ReportFinalReviewService.java | Service | Implements node-15 final review assignment/task and handoff to material archive with on-site ZIP projection |
| ReportTechReviewController.java | Controller | Exposes node-11 tech review list/detail/save/submit endpoints (reviewer sourced from node-8 assignment) |
| ReportTechReviewRecord.java | Model | Defines node-11 tech review read model |
| ReportTechReviewRequest.java | Model | Defines node-11 tech review save payload |
| ReportTechReviewService.java | Service | Implements node-11 technical review save/submit/task flow using node-8 assigned technical reviewer |
| ReviewActionRequest.java | Model | Defines generic review reject-remark payload |
| SecurityConfig.java | Config | Configures JWT-based security filter chain plus unified JSON `401/403` responses |
| SecurityProperties.java | Config | Defines security property set |
| UserAccountService.java | Service | Provides user lookup, role lookup, and role-filtered enabled-user query helpers |
| WorkflowController.java | Controller | Exposes workflow todo/approve/reject endpoints |
| WorkflowTaskDto.java | Model | Defines workflow todo read model |
| WorkflowTaskService.java | Service | Aggregates contract/project/quality/report-review todo tasks and dispatches actions with role-based review checks |
| WorkflowTraceRecord.java | Model | Defines workflow action trace read model |
