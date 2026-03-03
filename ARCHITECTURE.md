<!-- FORMAT-DOC: Update when project structure or architecture changes -->

# Architecture

Nature Platform 鍦?`codex` 鐩綍閲囩敤鍓嶅悗绔垎绂绘灦鏋勶細

- 鍚庣锛歚nature-platform-api`锛圫pring Boot + Flowable + MySQL + Redis + MinIO锛?- 鍓嶇锛歚nature-platform-web`锛圴ue 3 + Element Plus锛?
## 绛変繚 V1 涓绘祦绋嬶紙鑺傜偣 1-16锛?
1. 瀹㈡埛绠＄悊  
2. 鍚堝悓绠＄悊  
3. 鍚堝悓瀹℃牳  
4. 鍚堝悓褰掓。  
5. 椤圭洰鐧昏鐢宠  
6. 椤圭洰鐧昏瀹℃牳涓庡垎閰? 
7. 鍏畨鐧昏  
8. 鐜板満娴嬭瘎瀹炴柦锛堜笂浼?ZIP + 鍒嗛厤鎶€鏈?鍐呭技术/管理/网络 瀹℃牳浜猴級  
9. 璐ㄩ噺瀹℃牳鐢宠锛堝吋瀹圭綉鍏筹紝鐜板満娴嬭瘎鎻愪氦鏃惰嚜鍔ㄦ弧瓒筹級  
10. 璐ㄩ噺瀹℃牳浠诲姟锛堝吋瀹圭湅鏉匡紝浠诲姟鏀舵暃鍒板悗缁姤鍛婂鏍搁摼璺級  
11. 鎶ュ憡鏁翠綋鎶€鏈鏍? 
12. 鎶ュ憡鍐呭瀹℃牳锛圓/B/C 涓夎矾锛? 
13. 鎶ュ憡缂栧埗浠诲姟鍒嗛厤  
14. 鎶ュ憡缂栧埗骞朵笂浼? 
15. 鎶ュ憡鏈€缁堝鏍? 
16. 鏉愭枡褰掓。锛堟祦绋嬮棴鐜級

## 鏈疆鍏抽敭鏋舵瀯绾︽潫

- 瀹℃牳浜哄墠缃細鎶€鏈鏍镐汉銆佸唴瀹?技术/管理/网络 瀹℃牳浜虹粺涓€鍦ㄨ妭鐐?8锛堢幇鍦烘祴璇勶級閫夋嫨骞朵繚瀛橈紝鎻愪氦鍓嶅繀椤婚€夐綈 4 浜恒€?- ZIP 闂ㄧ锛氳妭鐐?8 蹇呴』涓婁紶鐜板満娴嬭瘎 ZIP 鍚庯紝鎵嶈兘淇濆瓨瀹℃牳浜哄垎閰嶅苟鎻愪氦銆?- 璺ㄨ妭鐐瑰彲瑙侊細鑺傜偣 11-16 鍧囧彲鏌ョ湅鑺傜偣 8 鎻愪氦鐨勭幇鍦烘祴璇勫帇缂╁寘瀵硅薄閿€?- 鏈€缁堝鏍镐汉淇濇寔鍦ㄨ妭鐐?15 閰嶇疆涓庢彁浜わ紝涓嶅墠缃埌鑺傜偣 8銆?- 骞跺彂鎺у埗锛氬鏍镐汉鍒嗛厤浣跨敤 `workflow_assignment.version_no` 鍋氫箰瑙傞攣锛屽啿绐佽繑鍥炲埛鏂版彁绀恒€?
## Workflow 涓庣暀鐥?
- 涓氬姟涓婚敭锛歚PROJECT_REGISTER` + `project_register.id`
- 娴佺▼瀹炰緥闀滃儚锛歚workflow_instance`
- 娴佽浆鍔ㄤ綔鏃ュ織锛歚workflow_action_log`
- 鑺傜偣鐘舵€佸洖鍐欙細缁熶竴鐢?`ProjectWorkflowTraceService` 澶勭悊锛岀‘淇濋〉闈㈢姸鎬併€佸緟鍔炰换鍔′笌娴佺▼杞ㄨ抗涓€鑷淬€?
## 鏁版嵁妯″瀷鎵╁睍

### 宸茶惤鍦拌〃

- `police_register`
- `on_site_assessment`
- `workflow_assignment`
- `quality_review_apply`
- `quality_review_task`
- `report_tech_review_apply`
- `report_tech_review_task`
- `report_content_review_apply`
- `report_content_review_task`
- `report_compile_assignment`
- `report_compile_submission`
- `report_final_review_apply`
- `report_final_review_task`
- `material_archive`

## 妯″潡绱㈠紩

- [nature-platform-api](nature-platform-api/src/main/java/com/nature/platform/INDEX.md) - 鍚庣棰嗗煙鏈嶅姟銆佹帶鍒跺櫒涓庢祦绋嬭妭鐐瑰疄鐜?- [nature-platform-api-tests](nature-platform-api/src/test/java/com/nature/platform/INDEX.md) - 鍚庣鍗曞厓娴嬭瘯涓庡洖褰掍繚鎶?- [nature-platform-web-src](nature-platform-web/src/INDEX.md) - 鍓嶇璺敱銆侀〉闈笌 API 鏈嶅姟灏佽

## 鍓嶇涓婚灞傦紙2026-02-12锛?
- 鏂板 `nature-platform-web/src/styles/tokens.css`锛氱粺涓€棰滆壊銆佸瓧鍙枫€侀棿璺濄€佸渾瑙掋€侀槾褰变笌甯冨眬 token銆?- 鏂板 `nature-platform-web/src/styles/base.css`锛氱粺涓€椤甸潰瀹瑰櫒銆佹爣棰樺尯涓庡叏灞€鎺掔増鍩虹嚎銆?- 鏂板 `nature-platform-web/src/styles/element-overrides.css`锛氱粺涓€ Element Plus 缁勪欢瑙嗚锛堝崱鐗?琛ㄦ牸/琛ㄥ崟/鎸夐挳/寮圭獥/鎻愮ず锛夈€?- 璺敱灞傛敼涓烘噿鍔犺浇锛坄nature-platform-web/src/router.ts`锛夛紝閰嶅悎 `nature-platform-web/vite.config.ts` manualChunks 鍒嗗寘闄嶄綆棣栧寘鍘嬪姏銆?

## Admin Management Module (2026-02-25)
- Backend adds IAM and workflow-governance schema via `V9__iam_workflow_admin_schema.sql` (`iam_role`, `iam_permission`, `iam_role_permission`, `workflow_definition_registry`, `workflow_node_rule`, `workflow_node_rule_item`, `admin_audit_log`).
- New admin APIs are exposed under `/api/v1/admin/*` for user, role, permission, workflow-definition, node-rule, and audit-log management.
- `OnSiteAssessmentService` now resolves reviewer candidate role pools from configurable node-rule slots (`TECH_REVIEWER`, `CONTENT_REVIEWER_TECH/MANAGEMENT/NETWORK`) with fallback defaults.
- Frontend adds five management pages: `/admin-users`, `/admin-roles`, `/admin-permissions`, `/admin-workflow`, `/admin-audit-logs`.

## RBAC Permission Refinement (2026-02-26)
- Backend adds `V10__permission_code_resource_action.sql` to migrate admin permission codes to `resource:action` format (`user:manage`, `role:manage`, `permission:view`, `workflow:manage`, `workflow-node-rule:manage`, `audit:view`).
- `/api/v1/auth/me` now returns both `roles` and `permissions`, enabling frontend route/button-level authorization decisions from one profile payload.
- Role management adds role-centric user assignment APIs: `GET /api/v1/admin/roles/{roleCode}/users`, `PUT /api/v1/admin/roles/{roleCode}/users`, and `GET /api/v1/admin/roles/user-options`.
- Frontend introduces global `v-permission` + `hasPermission()` (`nature-platform-web/src/permission.ts`) and route/nav permission binding via `navigation.ts` + `router.ts`.
- `AdminRolesView.vue` now supports a transfer-based "assign users by role" workflow, aligning role-permission-role-user maintenance in one page.

## Permission Governance Refactor (2026-02-26)
- 鏉冮檺鏁版嵁娌荤悊浠庘€滆縼绉昏剼鏈€愭潯鎻掑叆鈥濊皟鏁翠负鈥滃悗鍙板彲缁存姢 + 鍚姩鑷姩鍚屾鈥濓細
  - 缁撴瀯杩佺Щ浣跨敤 `V11__iam_permission_management_upgrade.sql`锛屼粎鍋?`iam_permission` 瀛楁鍗囩骇锛坄enabled`銆乣built_in`锛夈€?  - 涓哄吋瀹瑰凡鎵ц鏃х増鏈縼绉荤殑寮€鍙戝簱锛岃ˉ鍏?`V13__iam_permission_management_compat.sql` 鍏滃簳鍚岀粨鏋勫崌绾с€?  - 涓氬姟/鎶ュ憡/寰呭姙鏉冮檺鏂板涓嶅啀渚濊禆 Flyway 鏁版嵁杩佺Щ锛岀粺涓€鐢?`BuiltInPermissionRegistry` + `PermissionSyncService` 鑷姩 upsert銆?- 鏂板 `app.permission` 閰嶇疆锛?  - `sync-on-startup`锛氭槸鍚﹀湪鏈嶅姟鍚姩鏃惰嚜鍔ㄥ悓姝ュ唴缃潈闄愩€?  - `sync-overwrite-text`锛氭槸鍚﹁鐩栨暟鎹簱涓殑鍐呯疆鏉冮檺鍚嶇О/鎻忚堪鏂囨銆?- 绠＄悊鍚庡彴鏉冮檺妯″潡浠庡彧璇诲崌绾т负鍙不鐞嗭細
  - `GET /api/v1/admin/permissions` 鏀寔绛涢€夋煡璇?  - `POST /api/v1/admin/permissions` 鏂板缓鏉冮檺
  - `PUT /api/v1/admin/permissions/{permissionCode}` 缂栬緫鏉冮檺
  - `DELETE /api/v1/admin/permissions/{permissionCode}` 鍒犻櫎鑷畾涔夋潈闄愶紙鍐呯疆鏉冮檺绂佸垹锛?  - `POST /api/v1/admin/permissions/sync` 鎵嬪姩鍚屾鍐呯疆鏉冮檺
- 鏉冮檺鏂囨绛栫暐锛?  - `permission_code` 淇濇寔绋冲畾鑻辨枃鐮侊紙绋嬪簭鏍囪瘑锛?  - `permission_name` 涓?`description` 榛樿涓枃锛屾敮鎸佸悗鍙扮紪杈?- 娴佺▼绠＄悊涓殑鈥滈樁娈碉紙stage锛夆€濇敼涓哄彲閫夐」骞跺悗绔己鏍￠獙锛屽綋鍓嶅浐瀹氫负 `BUSINESS` / `REPORT` / `SYSTEM`銆?


## Process Overview Detail (2026-02-27)
- Backend keeps aggregate endpoint `GET /api/v1/process-overview/{projectId}` via `ProcessOverviewController` + `ProcessOverviewService`, unifying node snapshots from project register through material archive.
- The aggregate model `ProcessOverviewRecord` includes per-node current-state sections and normalized attachment summaries (`stage`, `field`, `objectKey`, `fileName`).
- Frontend removes standalone `/process-overview/:projectId` route and `ProcessOverviewView.vue`; all business/review pages now route to unified `TaskDetailView.vue` for context + action.

## Contract Page Split (2026-02-27)
- Frontend business route `/contracts` is split into two pages:
  - `/contract-submissions` (`ContractSubmissionsView.vue`) for create/edit/delete/submit-review.
  - `/contract-archives` (`ContractArchivesView.vue`) for archive-stage execution.
- Backend adds `GET /api/v1/contracts/archive-list`, guarded by `contract:archive`, to support archive page list loading.
- RBAC page resources are split from `page.contracts` into:
  - `page.contract-submissions`
  - `page.contract-archives`
- Flyway migration `V16__contract_page_split_resources.sql` migrates existing role-resource mappings from old contract page to both new pages and removes stale `page.contracts` resources.

## Unified Task Detail Page (2026-02-28)
- Frontend adds route `/task-detail/:taskType/:bizId` and page `TaskDetailView.vue` as the single review detail entry for workflow center and review-stage pages.
- Review-related pages (`WorkflowView.vue`, `QualityReviewsView.vue`, `ReportTechReviewsView.vue`, `ReportContentReviewsView.vue`, `ReportFinalReviewsView.vue`) now use one `详情` button and stop relying on modal-based detail popups.
- `TaskDetailView.vue` supports:
  - stage-bounded visibility (show data up to current workflow node),
  - attachment list with direct download,
  - in-page approve/reject actions when current user has an active pending task.
- Backend adds `GET /api/v1/workflow/tasks/contracts/{id}/detail` for contract review detail, so reviewers can read submitted contracts without opening contract management pages.
- Backend `FileAssetController` upgrades download API to `GET /api/v1/files/download-url?objectKey=...&taskType=...&bizId=...` and validates attachment ownership against current task context before issuing signed URLs.

## Final Reviewer Preassignment (2026-02-28)
- Final reviewer ownership is moved to final-review node rules (`REPORT_FINAL_REVIEW_TASK` + `FINAL_REVIEWER` slot), no longer configured in node-8 assignment.
- `OnSiteAssessmentService` now enforces four assignees only (tech + content-tech/content-management/content-network) and blocks edit/assignment while under review (except rectification).
- `ReportCompileService` no longer reads `workflow_assignment.final_reviewer`; final-review task creation delegates to node-rule based assignee resolution in `ReportFinalReviewService`.
- `ReportFinalReviewService` resolves final reviewer from node-rule role bindings and requires a unique enabled reviewer candidate.
- Frontend `ReportFinalReviewsView.vue` aligns with tech-review interactions by adding list-level approve/reject plus unified detail entry.

## IAM Department & Data Scope (2026-03-02)
- Backend migration adds organization and data-range schema: `iam_department`, `iam_role_data_scope_dept`, `iam_role.data_scope`, `iam_role.project_view_all`, `user_account.dept_id/ding_*`, `user_role.sort_order`.
- Admin module adds department management APIs (`/api/v1/admin/departments`) and DingTalk organization sync API (`/api/v1/admin/dingtalk/sync`).
- Role management extends to data scope (`SELF/DEPT/DEPT_AND_SUB/CUSTOM/ALL`) and project-wide visibility switch; role-user bindings now persist order.
- Business lists for contracts, project registers, police registers, and on-site assessments apply creator-based data filtering through `UserDataScopeService`.
- Frontend adds `/admin-departments` page and updates user/role management forms to maintain department binding and role data-scope settings.

## Legacy Quality-Review Cleanup (2026-03-03)
- Removed obsolete quality-review UI and API stack that was superseded by the direct report review chain.
- Backend deleted `/api/v1/quality-reviews` controller/service and related DTO/models.
- Frontend deleted `QualityReviewsView.vue`, removed `/quality-reviews` route, and removed `quality-review-service.ts`.
- Task detail aggregate schema no longer exposes `qualityReview`; now only keeps active nodes in current workflow.
- Permission vocabulary and resource mapping removed `quality-review:*` and `page.quality-reviews` entries from runtime code.

## Detail and Evidence Model Upgrade (2026-03-03)
- On-site assessment is upgraded from single `package_object_key` to multi-file evidence (`evidence_files_json`) with explicit remark (`assessment_remark`), while keeping legacy `package_object_key` as compatibility mirror.
- Material archive adds formal checklist enum storage (`material_status_codes_json`) and is validated against fixed business codes on save.
- Workflow task center removes list-level approve/reject actions; approval actions are now unified in `/task-detail/:taskType/:bizId`.
- Frontend adds read-only business detail route `/entity-detail/:entityType/:id` for customer/contract/project/report/material viewing without entering audit actions.
