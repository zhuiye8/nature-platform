# 实体字段说明 — Nature 等保测评平台

> 本文档记录每个业务实体的字段定义、来源、业务规则。
> 与 `schema.sql` DDL 文件对应，作为开发和审核的参考依据。
> 最后更新：2026-03-23

---

## 1. 客户（customer）

### 来源
- 用户需求文档明确简化：合并联系人到客户表，去掉 DMS V2.0 中大量非核心字段
- 参考 codex `customer` 表，保留核心字段

### 字段清单

| 字段 | 类型 | 必填 | 说明 | 来源 |
|------|------|------|------|------|
| full_name | VARCHAR(255) | 是 | 客户全称 | 用户需求 |
| industry | VARCHAR(128) | 否 | 客户行业（一级） | 用户需求 |
| region | VARCHAR(128) | 否 | 客户地区（省/市/区） | 用户需求 |
| address_detail | VARCHAR(255) | 否 | 详细地址 | 用户需求 |
| uscc | VARCHAR(64) | 否 | 统一社会信用代码 | 用户需求 |
| contact_name | VARCHAR(64) | 否 | 联系人名称 | 用户需求（合并） |
| mobile_phone | VARCHAR(32) | 否 | 移动电话 | 用户需求（合并） |
| is_government | BOOLEAN | 否 | 是否政府单位 | codex 保留 |
| remark | TEXT | 否 | 备注 | 用户需求 |

### 与 DMS V2.0 对比（去掉的字段）
- 管理层、二级客户行业、友好度、一级响应、省直单位
- 上级单位、客户来源、客户等级、客户类型、英文名称
- 独立联系人表（部门、职务、性别、年龄、座机、电子邮箱、地址、状态、兴趣爱好）

### 可见性规则
- 列表：所有人可见
- 详情：所有人可见
- 编辑：仅创建人
- 删除：不支持（客户不进回收站）

---

## 2. 合同（contract）

### 来源
- 用户需求：中标信息 + 合同信息二合一填写
- 参考 codex `contract` 表
- 参考 DMS V2.0 截图中的中标信息审批表

### 字段清单

#### 2.1 创建时填写（中标+合同二合一）

| 字段 | 类型 | 必填 | 说明 | 来源 |
|------|------|------|------|------|
| customer_id | BIGINT FK | 是 | 关联客户（选择） | 需求 |
| project_name | VARCHAR(255) | 是 | 项目名称 | 需求 |
| payment_company | VARCHAR(255) | 否 | 付款单位（签约单位） | 需求 |
| payment_amount | DECIMAL(18,2) | 否 | 付款金额（元） | 需求 |
| payment_method | VARCHAR(128) | 否 | 付款方式（填写+选择） | 需求 |
| partner_name | VARCHAR(255) | 否 | 合作方名称 | 需求 |
| sales_person_id | BIGINT FK | 否 | 签单销售（选择用户） | 需求 |
| performance_city | VARCHAR(64) | 否 | 业绩归属城市 | 需求 |
| deal_status | VARCHAR(64) | 否 | 客户成交情况 | 需求 |
| contract_type | VARCHAR(64) | 否 | 合同类型（选择） | 需求 |
| service_years | JSONB | 是 | 服务年份 [2026, 2027] | 需求 |
| contract_file_key | VARCHAR(512) | 否 | 合同文件（压缩包，MinIO） | 需求 |
| remark | TEXT | 否 | 备注 | 需求 |

> 联系人名称、移动电话：继承自客户，不单独存。前端显示时从 customer 关联读取。

#### 2.2 审核通过后自动生成

| 字段 | 类型 | 说明 | 生成规则 |
|------|------|------|---------|
| contract_no | VARCHAR(64) | 合同编号 | `YZN-YYYY-XXXX`（4 位序号，每年重置） |
| contract_name | VARCHAR(500) | 合同名称 | 客户名称 + 系统展示 + 服务年份展示 |
| application_form_no | VARCHAR(64) | 申请单编号 | 自动生成 |
| service_year_detail | TEXT | 合同服务年份详情 | 系统自动整理 |

**合同名称拼接规则：**
```
客户名称 + 系统展示 + 服务年份展示

系统展示规则：
  ≤ 3 个系统 → 全部展示名称
  > 3 个系统 → 仅展示等级 + 数量（如"二级系统×2，三级系统×1"）

年份展示规则：
  连续年份 → 2026-2028
  非连续年份 → 2026,2027,2029
```

#### 2.3 归档时商务补充

| 字段 | 类型 | 说明 | 操作人 |
|------|------|------|--------|
| signed_at | TIMESTAMPTZ | 签订时间 | 商务 |
| file_count | INT | 文件份数 | 商务 |
| storage_location | VARCHAR(255) | 存放位置 | 商务 |
| archive_status | VARCHAR(32) | 归档状态 | 商务 |
| archive_scan_key | VARCHAR(512) | 归档扫描件（MinIO） | 商务 |
| payment_status | VARCHAR(32) | 回款状态 | 商务 |
| archive_remark | TEXT | 归档备注 | 商务 |

#### 2.4 状态字段

| 字段 | 枚举值 | 说明 |
|------|--------|------|
| review_status | DRAFT → SUBMITTED → APPROVED / REJECTED | 审核流程状态 |
| archive_status | PENDING_ARCHIVE → ARCHIVED | 归档状态 |
| payment_status | UNPAID → PARTIAL → PAID | 回款状态 |

### 可见性规则
- 列表：所有销售可见（仅合同名、归属人、状态）；商务看全部列
- 详情：创建人看全部；其他销售看部分字段（不含金额等）；商务/管理员看全部
- 编辑：创建人（草稿态）；商务（归档字段）
- 删除：仅创建人（草稿态），进回收站

---

## 3. 合同系统明细（contract_system_item）

### 来源
- codex `contract_system_item` 表
- 用户需求：二级系统数+名称、三级系统数+名称

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contract_id | BIGINT FK | 是 | 关联合同 |
| system_name | VARCHAR(255) | 是 | 系统名称 |
| system_level | SMALLINT | 是 | 安全等级（1-5，主要 2/3） |
| sort_order | INT | 否 | 排序 |

---

## 4. 合同序号（contract_serial）

### 来源
- codex `contract_serial` 表，保持不变

| 字段 | 类型 | 说明 |
|------|------|------|
| serial_year | INT PK | 年份 |
| next_seq | INT | 下一个序号（从 1 开始） |

**使用方式：** `SELECT FOR UPDATE` 获取当前值并 +1，保证并发安全。

---

## 5. 项目登记（project_register）

### 来源
- codex `project_register` 表
- 用户需求文档 + DMS V1.0 截图

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contract_id | BIGINT FK | 是 | 选择合同 |
| contract_year | INT | 是 | 选择服务年份（已创建不可选） |
| application_name | VARCHAR(500) | 是 | 自动生成 |
| status | VARCHAR(32) | — | DRAFT / SUBMITTED / APPROVED / REJECTED |
| remark | TEXT | 否 | 备注 |

**唯一约束：** `UNIQUE(contract_id, contract_year) WHERE deleted = FALSE`

**申请单名称自动生成规则：**
```
{申请人}-系统登记申请-{合同名称}+{选择的合同年份}-{日期YYYY-MM-DD}
```

### 可见性规则
- 列表：所有人可见（摘要列）；管理员看全部
- 详情：创建人 + 被分配成员 + 管理员
- 编辑：创建人（草稿态）
- 删除：创建人（草稿态），进回收站

---

## 6. 项目系统明细（project_system_item）

### 来源
- codex `project_system_item` 表
- DMS V1.0 截图「系统详情」弹窗
- 用户需求文档

| 字段 | 类型 | 必填 | 说明 | 来源 |
|------|------|------|------|------|
| project_register_id | BIGINT FK | 是 | 关联项目登记 | — |
| system_name | VARCHAR(255) | 是 | 系统名称 | 需求 |
| filing_agency | VARCHAR(255) | 是 | 备案机关（省-市-区/县） | 截图 |
| security_level | VARCHAR(64) | 是 | 安全保护等级 | 截图 |
| is_reassessment | BOOLEAN | 是 | 是否复测 | 截图 |
| required_entry_date | DATE | 是 | 要求入场时间 | 截图 |
| required_report_delivery_date | DATE | 是 | 要求报告交付日期 | 截图 |
| assessed_unit_name | VARCHAR(255) | 是 | 被测单位名称 | 截图 |
| assessed_unit_industry | VARCHAR(128) | 是 | 被测单位所属行业 | 截图 |
| assessed_unit_contact | VARCHAR(64) | 是 | 被测单位联系人（继承可编辑） | 截图 |
| assessed_unit_mobile | VARCHAR(32) | 是 | 被测单位联系方式（继承可编辑） | 截图 |
| assessed_unit_address | VARCHAR(255) | 是 | 被测单位项目地址（继承可编辑） | 截图 |
| has_filing_certificate | BOOLEAN | 是 | 是否具有备案证明 | 截图 |
| filing_certificate_no | VARCHAR(128) | 条件 | 备案证明编号 | 截图 |
| filing_certificate_issued_at | DATE | 条件 | 证明出具时间 | 截图 |
| has_filing_form | BOOLEAN | 是 | 是否具有备案表 | 截图 |
| has_classification_report | BOOLEAN | 是 | 是否具有定级报告 | 截图 |

> 备案证明文件、备案表文件、定级报告文件：通过 `file_attachment` 表关联（biz_type=PROJECT, slot_key=filing_cert/filing_form/class_report）

**备案证明编号格式校验：**
```
[11位数字-5位数字] 或 [6位数字-5位数字-5位数字] 或 [16位数字] 或 [15位数字]
```

---

## 7. 项目成员（project_member）

### 来源
- 替代 codex 的 `project_assessment_member` + `workflow_assignment`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | BIGINT FK | 是 | 关联项目登记 |
| user_id | BIGINT FK | 是 | 用户 ID |
| role_type | VARCHAR(32) | 是 | 项目内角色（见下表） |
| status | VARCHAR(16) | — | ACTIVE / REMOVED |
| assigned_at | TIMESTAMPTZ | 是 | 分配时间 |
| assigned_by | BIGINT | 是 | 分配人 |
| removed_at | TIMESTAMPTZ | 否 | 移除时间 |

### role_type 枚举

| 值 | 说明 | 分配时机 |
|----|------|---------|
| PM | 项目经理 | 项目审核通过时 |
| ASSESSOR | 测评师 | 项目审核通过时 |
| TECH_REVIEWER | 整体技术审核人 | 质量审核自动分配 |
| CONTENT_REVIEWER_A | 内容审核人 A（技术） | 质量审核自动分配 |
| CONTENT_REVIEWER_B | 内容审核人 B（管理） | 质量审核自动分配 |
| CONTENT_REVIEWER_C | 内容审核人 C（网络） | 质量审核自动分配 |
| REPORT_WRITER | 报告编制人 | 报告分配时 |

### 该表解决的问题

| 场景 | 查询方式 |
|------|---------|
| 现场测评可见性 | `WHERE project_id = ? AND role_type IN ('PM','ASSESSOR') AND status = 'ACTIVE'` |
| 质量审核回避名单 | `WHERE project_id = ? AND status = 'ACTIVE'` → 排除这些 user_id |
| 审核人变更 | `UPDATE status = 'REMOVED'` → INSERT 新记录 |
| 项目组全员 | `WHERE project_id = ? AND status = 'ACTIVE'` |

---

## 8. 公安登记（police_register）

### 来源
- codex `police_register` 表
- 用户需求：专职角色处理，上传证明 + 选择项目经理

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_register_id | BIGINT FK | 是 | 关联项目（唯一） |
| register_no | VARCHAR(128) | 否 | 登记编号 |
| filing_agency | VARCHAR(255) | 否 | 办理机关 |
| contact_name | VARCHAR(64) | 否 | 联系人 |
| contact_phone | VARCHAR(32) | 否 | 联系电话 |
| project_manager_id | BIGINT FK | 否 | 选择项目所属项目经理 |
| remark | TEXT | 否 | 备注 |
| status | VARCHAR(32) | — | DRAFT / SUBMITTED |

> 公安登记证明文件：通过 `file_attachment` 表关联

### 可见性规则
- 仅公安登记专员角色 + 管理员可见
- 非项目组成员操作

---

## 9. 现场测评（on_site_assessment）

### 来源
- codex `on_site_assessment` 表
- 用户需求：多人协作，PM + 测评师各自提交

| 字段 | 类型 | 说明 |
|------|------|------|
| project_register_id | BIGINT FK | 关联项目（唯一） |
| assessment_detail | TEXT | 测评汇总说明 |
| assessment_remark | TEXT | 备注 |
| status | VARCHAR(32) | DRAFT / IN_PROGRESS / SUBMITTED / QUALITY_REVIEW_STARTED |

> 每个成员的提交通过 `wf_task` 追踪（MULTI_ASSIGNEE 节点）
> 证据文件通过 `file_attachment` 关联

### 可见性规则
- 仅被分配的项目组成员（PM + 测评师）+ 管理员
- PM 专有按钮：「发起质量审核」

---

## 10. 材料归档（material_archive）

### 来源
- codex `material_archive` 表
- 用户需求：报告+表单归档

| 字段 | 类型 | 说明 |
|------|------|------|
| project_register_id | BIGINT FK | 关联项目（唯一） |
| material_status_codes | JSONB | 材料清单状态 |
| remark | VARCHAR(1000) | 备注 |
| status | VARCHAR(32) | DRAFT / SUBMITTED / ARCHIVED |

> 归档文件通过 `file_attachment` 关联（biz_type=ARCHIVE）

---

## 11. 角色体系

### 12 个系统角色

| 角色编码 | 显示名 | 职责 | 关键权限 |
|---------|--------|------|---------|
| super_admin | 超级管理员 | 全权限 | 所有 |
| sales | 销售 | 创建客户/合同 | customer:create, contract:create |
| commercial | 商务 | 审核合同、归档 | contract:review, contract:archive, contract:view_all |
| police_register | 公安登记专员 | 处理公安登记 | police:operate |
| project_manager | 项目经理 | 管现场测评，发起质量审核 | assessment:submit, assessment:start_qr |
| assessor | 测评师 | 执行现场测评 | assessment:submit |
| tech_reviewer | 整体技术审核员 | 质量审核（技术 slot） | quality_review:review |
| content_reviewer_tech | 内容审核员（技术） | 质量审核（内容 A slot） | quality_review:review |
| content_reviewer_mgmt | 内容审核员（管理） | 质量审核（内容 B slot） | quality_review:review |
| content_reviewer_network | 内容审核员（网络） | 质量审核（内容 C slot） | quality_review:review |
| report_writer | 报告编制员 | 编制报告 | report:compile |
| dept_manager | 部门经理 | 审核合同/项目/报告 | project:review, report:review |

### 角色内用户排序机制

`user_role.sort_order` 决定自动选人的优先级：

```
示例：tech_reviewer 角色
  sort_order=1 → 陈彦文（默认第一候选）
  sort_order=2 → 陈新东（回避时的备选）

选人算法：
1. 读取该角色的所有用户，按 sort_order 升序排列
2. 检查第一个是否在回避名单中
3. 不在 → 选中；在 → 检查下一个
4. 全部回避 → 提示管理员手动指定
```

---

## 12. 菜单结构

```
仪表盘                           page.dashboard

业务流程（group.business）
├── 客户管理                      page.customers
├── 合同管理                      page.contracts
├── 项目登记                      page.project-registers
├── 公安登记                      page.police-registers
├── 现场测评                      page.on-site-assessments
└── 质量审核                      page.quality-reviews（审核人专属）

报告与归档（group.report）
├── 编制分配                      page.report-assignments
├── 报告编制                      page.report-compile
├── 报告审核                      page.report-reviews
└── 材料归档                      page.material-archives

系统管理（group.system）
├── 用户管理                      page.admin-users
├── 角色管理                      page.admin-roles
├── 资源管理                      page.admin-resources
├── 部门管理                      page.admin-departments
├── 流程管理                      page.admin-workflow
├── 审计日志                      page.admin-audit-logs
└── 回收站                        page.recycle-bin

待办审批                          page.workflow（所有人可见）
```

---

## 13. 工作流定义

### 流程 A：合同流程（CONTRACT_FLOW）

```
[START] →AUTO→ CONTRACT_CREATE →SUBMIT→ CONTRACT_REVIEW →APPROVE→ CONTRACT_ARCHIVE →SUBMIT→ [END]
                                                         →REJECT→ CONTRACT_CREATE（驳回重填）
```

| 节点 | 类型 | 操作人 |
|------|------|--------|
| CONTRACT_CREATE | SIMPLE | 销售（创建人） |
| CONTRACT_REVIEW | REVIEW | 商务/部门经理（wf_assignment_rule 配置） |
| CONTRACT_ARCHIVE | SIMPLE | 商务 |

### 流程 B：项目测评流程（PROJECT_ASSESSMENT_FLOW）

```
[START] →AUTO→ PROJECT_REGISTER →SUBMIT→ PROJECT_REVIEW →APPROVE→ POLICE_REGISTER
                                          →REJECT→ PROJECT_REGISTER

→SUBMIT→ ON_SITE_ASSESSMENT →ALL_COMPLETE→ QUALITY_REVIEW →ALL_APPROVED→ REPORT_ASSIGNMENT
                                            →ANY_REJECTED→ ON_SITE_ASSESSMENT（驳回重测）

→SUBMIT→ REPORT_COMPILE →SUBMIT→ REPORT_REVIEW →APPROVE→ MATERIAL_ARCHIVE →SUBMIT→ [END]
                                                 →REJECT→ REPORT_COMPILE（驳回重编）
```

| 节点 | 类型 | 操作人 |
|------|------|--------|
| PROJECT_REGISTER | SIMPLE | 销售（创建人） |
| PROJECT_REVIEW | REVIEW | 部门经理 + 分配项目组 |
| POLICE_REGISTER | SIMPLE | 公安登记专员 |
| ON_SITE_ASSESSMENT | MULTI_ASSIGNEE | PM + 测评师（各自提交） |
| QUALITY_REVIEW | PARALLEL_REVIEW | 技术审核×1 + 内容审核 A/B/C（自动选人+回避） |
| REPORT_ASSIGNMENT | SIMPLE | 部门经理（分配编制人） |
| REPORT_COMPILE | SIMPLE | 报告编制员 |
| REPORT_REVIEW | REVIEW | 部门经理 |
| MATERIAL_ARCHIVE | SIMPLE | 归档操作人 |

---

## 14. 质量审核自动选人规则（wf_assignment_rule 种子数据）

| 节点 | Slot | 角色 | 回避规则 | 优先级 |
|------|------|------|---------|--------|
| QUALITY_REVIEW | TECH | tech_reviewer | SAME_PROJECT | 10 |
| QUALITY_REVIEW | TECH | super_admin | SAME_PROJECT | 99 |
| QUALITY_REVIEW | CONTENT_A | content_reviewer_tech | SAME_PROJECT | 10 |
| QUALITY_REVIEW | CONTENT_A | super_admin | SAME_PROJECT | 99 |
| QUALITY_REVIEW | CONTENT_B | content_reviewer_mgmt | SAME_PROJECT | 10 |
| QUALITY_REVIEW | CONTENT_B | super_admin | SAME_PROJECT | 99 |
| QUALITY_REVIEW | CONTENT_C | content_reviewer_network | SAME_PROJECT | 10 |
| QUALITY_REVIEW | CONTENT_C | super_admin | SAME_PROJECT | 99 |
| CONTRACT_REVIEW | REVIEWER | commercial | NONE | 10 |
| PROJECT_REVIEW | REVIEWER | dept_manager | NONE | 10 |
| REPORT_REVIEW | REVIEWER | dept_manager | NONE | 10 |

> 每个 slot 都配了 super_admin 作为兜底（priority=99），确保极端情况下总有人可选

---

## 15. codex → 新系统对照表

| codex 表（35 张） | 新系统 | 变化 |
|------------------|--------|------|
| user_account | user_account | FK 改 BIGINT |
| iam_role | iam_role | 加 sort_order |
| iam_permission | iam_permission | CASL 格式 |
| iam_resource | iam_resource | 保持 |
| iam_role_permission | iam_role_permission | 保持 |
| iam_role_resource | iam_role_resource | 保持 |
| iam_department | iam_department | 仅筛选用 |
| iam_role_data_scope_dept | **删除** | 不用部门做权限 |
| iam_permission_code_legacy_map | **删除** | 新系统无历史包袱 |
| user_role | user_role | 加 sort_order |
| customer | customer | 大幅简化 |
| contract | contract | 保持 |
| contract_system_item | contract_system_item | 保持 |
| contract_serial | contract_serial | 保持 |
| project_register | project_register | 保持 |
| project_system_item | project_system_item | 文件改 file_attachment |
| project_assessment_member | **合并** → project_member | 统一项目成员表 |
| workflow_assignment | **合并** → project_member | 审核人也是成员 |
| workflow_instance | wf_instance | 增加 variables JSONB |
| workflow_action_log | wf_action_log | 增加 from/to_node |
| workflow_definition_registry | **替换** → wf_definition + wf_node + wf_transition | 图模型 |
| workflow_node_rule + rule_item | **替换** → wf_assignment_rule | 单表 |
| quality_review_apply | **删除** → wf_task | 统一 |
| quality_review_task | **删除** → wf_task | 统一 |
| report_tech_review_apply | **删除** → wf_task | 统一 |
| report_tech_review_task | **删除** → wf_task | 统一 |
| report_content_review_apply | **删除** → wf_task | 统一 |
| report_content_review_task | **删除** → wf_task | 统一 |
| report_compile_assignment | **删除** → wf_task | 统一 |
| report_compile_submission | **删除** → wf_task | 统一 |
| report_final_review | **删除** → wf_task | 统一 |
| report_final_review_task | **删除** → wf_task | 统一 |
| police_register | police_register | FK 改 BIGINT |
| on_site_assessment | on_site_assessment | 简化 |
| material_archive | material_archive | 保持 |
| system_notification | system_notification | FK 改 BIGINT |
| field_change_log | field_change_log | FK 改 BIGINT |
| admin_audit_log | admin_audit_log | 加 ip/user_agent |
| recycle_bin | recycle_bin | 加 snapshot_json |
| — | **新增** file_attachment | 集中文件元数据 |
| — | **新增** wf_definition | 流程定义（版本化） |
| — | **新增** wf_node | 节点定义（类型化） |
| — | **新增** wf_transition | 流转规则（图模型） |

**结果：35 张 → 27 张，功能完全覆盖，扩展性更强。**
