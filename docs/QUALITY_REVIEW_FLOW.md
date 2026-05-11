# 质量审核流程（Quality Review Flow）完整梳理

> 调研日期：2026-05-11（最后更新 2026-05-11）
> 数据源：以代码实际行为为准（`packages/server/src/modules/workflow/**` + `packages/web/src/pages/workflow/TaskDetail.vue`）
> 说明：术语首次出现用「中文（英文）」对照，方便与代码/数据库互对

---

## 0. 范围界定（修订版）

**质量审核闭环** = 项目测评流程（PROJECT_ASSESSMENT_FLOW）中从"现场测评"到"最终审核"的 **6 个节点**：

```
ON_SITE_ASSESSMENT（现场测评）
    ↓ PM 上传成果 + 发起质量审核
TECH_REVIEW（整体技术审核）              ← 4 路质量审核 第 1 路
    ↓
CONTENT_REVIEW（内容审核 3 路并行）       ← 4 路质量审核 第 2、3、4 路
    ↓
REPORT_ASSIGN（报告分配）                ← 报告分配人选编制人
    ↓
REPORT_COMPILE（报告编制）                ← 编制人上传报告
    ↓
FINAL_REVIEW（最终审核）                 ← 闭环出口
    ↓
[出闭环 → MATERIAL_ARCHIVE 材料归档]    ← 不属于审核流程，是业务流程的下一阶段
```

**为什么 6 个节点是一个闭环？**

`FINAL_REVIEW` 节点的 3 种驳回路径（REVIEW / REJECT / ADJUST）覆盖了 3 个不同的回滚点：
- REVIEW → 回 REPORT_COMPILE（最近一步）
- ADJUST → 回 ON_SITE_ASSESSMENT，并跳过质量审核直达 REPORT_ASSIGN（中等回滚）
- REJECT → 回 ON_SITE_ASSESSMENT，正常重做整个闭环（最远回滚）

这意味着 6 个节点**通过 FINAL_REVIEW 的回滚机制被绑成一个状态机闭环**。MATERIAL_ARCHIVE（材料归档）虽然在工作流里紧跟其后，但它**不参与回滚循环**，属于业务流程的下一阶段，本文档不展开。

---

## 1. 涉及角色全集

| 角色（代码） | 在闭环中的定位 |
|---|---|
| **项目经理 PM**（`project_manager` + 项目 `project_member.roleType='PM'`）| 闭环主动方：发起人 + 整改人 + 现场测评协作者 |
| **测评师**（`senior/middle/junior_assessor` + 项目 `roleType='ASSESSOR'`）| 现场测评协作者；**不能审核自己项目**（回避） |
| **整体技术审核员**（`tech_reviewer`）| TECH_REVIEW 节点审核人 |
| **内容审核员-技术**（`content_reviewer_tech`）| CONTENT_REVIEW.CONTENT_A 审核人 |
| **内容审核员-管理**（`content_reviewer_mgmt`）| CONTENT_REVIEW.CONTENT_B 审核人 |
| **内容审核员-网络**（`content_reviewer_network`）| CONTENT_REVIEW.CONTENT_C 审核人 |
| **报告分配人**（`report_assigner`）| REPORT_ASSIGN 节点的分配人 |
| **报告编制员**（`report_writer` + 项目 `roleType='REPORT_WRITER'`）| REPORT_COMPILE 节点的编制人 |
| **最终审核员**（`dept_manager`，与部门经理同一角色）| FINAL_REVIEW 节点的审核人 |
| **销售**（`sales`）| 知情人/抄送，**不参与质量审核**，能查项目列表 |
| **部门经理**（`dept_manager`）| 同时担任最终审核员 |
| **项目主管**（`project_director`）| 与质量审核无关，能查项目列表 |
| **超级管理员**（`super_admin`）| 全权限，可代替任何人操作（兜底） |
| **董事长**（`chairman`）| 全只读，看全部但不能操作 |

---

## 2. 流程总览（自然语言版）

1. **现场测评**：PM + 多个测评师协作，每人上传自己负责的资料；PM 集中整理成"测评成果"（filePool='ASSESSMENT_RESULT'）。
2. **PM 发起质量审核**：点"发起质量审核"按钮 → 进入 TECH_REVIEW。
3. **TECH_REVIEW**：池化分配到所有 tech_reviewer，**回避当前项目成员**。
4. **CONTENT_REVIEW（3 路并行）**：3 个 slot 各**预绑定**一个非项目成员审核人，3 人同时收到任务互不依赖。
5. **REPORT_ASSIGN**：报告分配人在通过时选择具体的 report_writer，写入 project_member（REPORT_WRITER 角色），workflow 自动绑定 REPORT_COMPILE 任务到该编制人。
6. **REPORT_COMPILE**：编制人上传报告文件（必须）后点"通过"。
7. **FINAL_REVIEW（最终审核）**：dept_manager 决定 4 个去向（见下方第 4 节）。

---

## 3. 节点级详细说明

### 3.1 节点：ON_SITE_ASSESSMENT（现场测评）

| 项 | 内容 |
|---|---|
| 节点类型 | MULTI_ASSIGNEE（多人协作） |
| 任务分配 | 进入节点时按 `project_member` 中 PM + ASSESSOR **逐人**创建独立任务 |
| 完成条件 | 所有 task 都 COMPLETED（PM 显式"发起质量审核"会把所有 PENDING task 批量 SUBMIT） |
| 触发下一步 | PM 点"发起质量审核" → 调 `POST /assessment/:id/initiate-review`（**只有 PM 能调，校验 project_member.roleType='PM'**）|

#### 各角色视角

| 角色 | 待办中心 | 现场测评列表（`/assessment`）| 现场测评详情页 |
|---|---|---|---|
| **PM** | 看到"新待办：现场测评"任务 | 看到本项目 | 能上传/删除文件（任何文件池），能点"发起质量审核"按钮（前提：测评成果池非空） |
| **测评师（ASSESSOR）** | 看到自己的"现场测评"任务 | 看到本项目 | 能上传/删除 ASSESSOR_INPUT 池文件，**不能**发起质量审核 |
| **销售** | 无任务 | 看到本项目（签单销售可见）| 只读 |
| **部门经理 / 项目主管** | 无任务 | 看到本项目 | 只读 |
| **审核人**（tech / content_reviewer / report_writer / dept_manager 但非本项目成员）| 无任务 | **看不到本项目**（assessment 列表只对 project_member 开放）| — |
| **super_admin / chairman** | 视情况 | 看全部 | 看全部 |

---

### 3.2 节点：TECH_REVIEW（整体技术审核）

| 项 | 内容 |
|---|---|
| 节点类型 | REVIEW（单审） |
| 任务分配 | **池化**：assigneeId=null。所有 `tech_reviewer` 都看到这条；**回避 SAME_PROJECT**：当前项目的 PM/ASSESSOR 即使有该角色也被排除 |
| 完成条件 | 任意一位 tech_reviewer 操作（**先点先得**，原子 update）|
| 操作选项 | APPROVE / REVIEW / REJECT 三选一 |
| APPROVE 后 | 节点完成 → 进 CONTENT_REVIEW（同时创建 3 个并行任务）|
| REVIEW 后 | 任务 → PENDING_RECTIFICATION（**节点不变**），PM 收到通知；PM 改完点"重新提交" → 任务回 PENDING，原审核人重审 |
| REJECT 后 | 节点完成 → 回 ON_SITE_ASSESSMENT（roundNo+1） |

#### 各角色视角

| 角色 | 待办中心 | 项目列表 | 任务详情页 |
|---|---|---|---|
| **PM** | 无 TECH_REVIEW 任务（被回避）；收到 REVIEW/REJECT 通知 | 看到本项目 | 看得到任务存在但**不能操作**（canOperate=false）|
| **测评师** | 无（被回避）| 看到本项目 | 同 PM |
| **tech_reviewer（不在本项目）** | **看到 1 条池任务** | **看不到本项目**（不是 project_member）| 进入 → 看完整项目信息 + 测评成果文件池 + APPROVE/REVIEW/REJECT 三按钮 |
| **tech_reviewer（恰好是本项目 PM/ASSESSOR）** | **看不到**（SAME_PROJECT 回避）| — | — |
| **报告分配/编制 / dept_manager** | 无 | 看不到（除非有别的角色让他能看）| — |
| **super_admin** | 看到（兜底）| 看全部 | 任意操作 |

---

### 3.3 节点：CONTENT_REVIEW（内容审核，并行 3 路）

| 项 | 内容 |
|---|---|
| 节点类型 | PARALLEL_REVIEW（并行审核） |
| 任务分配 | 进入节点时**一次性**创建 3 个 task，分别**预绑定**：<br>• slot=CONTENT_A → 第一个非项目成员的 `content_reviewer_tech`<br>• slot=CONTENT_B → 第一个非项目成员的 `content_reviewer_mgmt`<br>• slot=CONTENT_C → 第一个非项目成员的 `content_reviewer_network`<br>**不是池任务**，是定向分配 |
| 完成条件 | 3 个 task 全部 COMPLETED |
| 节点完成事件 | 全部 APPROVED → `ALL_APPROVED` → REPORT_ASSIGN；任何一个 REJECTED → `ANY_REJECTED` → ON_SITE_ASSESSMENT |
| REVIEW 的特殊行为 | **任何一个审核人**点"复核"会触发**全部 3 个 task（含已 APPROVE 的）**都变 PENDING_RECTIFICATION，PM 整改后**所有人都要重新审** |

> ⚠️ 关于 REVIEW 影响全员的设计：这是当前的代码行为（`parallel-review.handler.ts:86-101`）。理由是"PM 整改可能影响整份成果，保险起见全员重审"。但业务上可能造成已通过的审核人不满 — "我都通过了为啥让我重新审？"

#### 各角色视角

| 角色 | 待办中心 | 项目列表 | 任务详情页 |
|---|---|---|---|
| **content_reviewer_tech**（非本项目成员）| 1 条"内容审核（技术）" | 看不到本项目 | 操作 APPROVE/REVIEW/REJECT |
| **content_reviewer_mgmt**（非本项目成员）| 1 条"内容审核（管理）" | 看不到本项目 | 同上 |
| **content_reviewer_network**（非本项目成员）| 1 条"内容审核（网络）" | 看不到本项目 | 同上 |
| **PM** | 无任务；任何一路 REVIEW 后 3 条整改任务挂到自己 | 看到本项目 | 看 3 路进度，不能操作 |
| **测评师** | 同 PM | 看到 | 同 PM |
| **其他角色** | 无 | 看情况 | 只读 |

---

### 3.4 节点：REPORT_ASSIGN（报告分配）

| 项 | 内容 |
|---|---|
| 节点类型 | REVIEW（单审，但语义是"分配 + 通过"）|
| 任务分配 | 池化给 `report_assigner` 角色 |
| 完成条件 | 报告分配人点"通过"时**必填一个 report_writer 用户 ID**（前端 ReportWriterCard 单选）|
| APPROVE 后 | `report.listener` 触发：<br>1. 写入 project_member（roleType='REPORT_WRITER'，userId=选定编制人）<br>2. 设 project_register.compiledBy = 编制人<br>3. **重试 5×500ms** 把刚创建的 REPORT_COMPILE 任务的 assigneeId 改为该编制人（解决工作流任务创建延迟的 race） |
| REVIEW 后 | PM 收到整改通知（PENDING_RECTIFICATION 路径）|
| REJECT 后 | 回 ON_SITE_ASSESSMENT |

#### 各角色视角

| 角色 | 待办中心 | 任务详情页 |
|---|---|---|
| **report_assigner**（池）| 1 条"报告分配" | 选编制人 + 写意见 + 通过 |
| **report_writer** | 无 | 看不到（任务还没分配过来）|
| **PM** | 无；REVIEW 后收到整改任务 | 看得到任务存在，不能操作 |
| **super_admin** | 看到（兜底）| 任意操作 |

---

### 3.5 节点：REPORT_COMPILE（报告编制）

| 项 | 内容 |
|---|---|
| 节点类型 | REVIEW（语义是"编制 + 提交"）|
| 任务分配 | 进入节点时先创建池任务，REPORT_ASSIGN 完成后由 `report.listener` 把 assigneeId 改为指定编制人（前述重试机制）|
| 完成条件 | **必须上传 ≥ 1 个编制报告文件**（`compile_report_file` 表），否则点"通过"会被 `workflow.service:292-313` 拦截报"请先上传编制报告"|
| APPROVE 后 | 进 FINAL_REVIEW |
| REVIEW 后 | PM 收到整改通知 |
| REJECT 后 | 回 ON_SITE_ASSESSMENT |

#### 各角色视角

| 角色 | 待办中心 | 项目列表 | 任务详情页 |
|---|---|---|---|
| **report_writer（被分配到的那个）** | 1 条"报告编制" | 看到（自己是 project_member.REPORT_WRITER）| 上传报告文件 + 通过 |
| **其他 report_writer** | 看不到（已被 assigneeId 锁定）| 看不到 | — |
| **PM** | 无；REVIEW 后收到整改任务 | 看到 | 看得到任务存在，不能操作 |
| **dept_manager / 测评师** | 无 | 看到 | 只读 |

---

### 3.6 节点：FINAL_REVIEW（最终审核）⭐ 闭环出口

| 项 | 内容 |
|---|---|
| 节点类型 | REVIEW（单审）|
| 任务分配 | 池化给 `dept_manager` 角色 |
| 完成条件 | 任意一位 dept_manager 操作（先点先得）|
| **4 种动作的实际去向** | **详见下方第 4 节专题** |

#### 各角色视角

| 角色 | 待办中心 | 任务详情页 |
|---|---|---|
| **dept_manager（部门经理 / 最终审核员）** | 1 条"最终审核" | 看完整报告 + 测评数据 + APPROVE/REVIEW/REJECT 三按钮 |
| **PM** | 无；任何驳回后收到通知 | 只读 |
| **report_writer** | 无；REVIEW 后收到整改任务 | 只读 |
| **其他角色** | 无 | 只读 |

---

## 4. 🎯 FINAL_REVIEW 的 4 种动作 + 完整回滚图谱

这一节是本文档的**重点**——FINAL_REVIEW 是闭环唯一的出口，它的 4 种动作覆盖了所有回滚场景。

### 4.1 动作行为对照

| 动作 | 实际回到哪 | 触发路径（代码事实）| 业务含义 |
|---|---|---|---|
| **APPROVE 通过** | MATERIAL_ARCHIVE（离开闭环 → 业务归档）| 正常 transition | 报告通过审核，进入归档 |
| **REVIEW 复核** | **REPORT_COMPILE（报告编制）**，重新绑定**原编制人** | `workflow.service.signal:347-454` 特殊处理 | 报告小问题，让原编制人改 |
| **REJECT 驳回** | **ON_SITE_ASSESSMENT（现场测评）**，roundNo+1 | `workflow.service.signal:475-489` 拦截 → `assessment.listener:35-44` → `rejectToAssessment` | 测评成果有大问题，PM 从头重做 |
| **ADJUST 调整** ⚠️ | ON_SITE_ASSESSMENT + `skip_to_final=true` flag → PM 重做后跳过 4 路质量审核 → 直达 REPORT_ASSIGN | 正常 transition + guard | （**设计中但当前未接通前端**，详见 4.3）|

### 4.2 回滚图谱（可视化）

```
                          ┌─────────────────────────────────────┐
                          │                                     │
                          │  REJECT（最远回滚，重做整个闭环）       │
                          │                                     ▼
ON_SITE_ASSESSMENT ──────────────────────────────────────────► TECH_REVIEW
       ▲                                                            │
       │                                                            ▼
       │ ADJUST + skip_to_final guard                          CONTENT_REVIEW
       │ ──── 跳过 4 路质量审核 ────►                                │
       │                                                            ▼
       │                                                       REPORT_ASSIGN
       │                                                            │
       │                                                            ▼
       │                                                       REPORT_COMPILE  ◄──┐
       │                                                            │             │
       │                                                            ▼             │
       │                                                       FINAL_REVIEW ──REVIEW（最近回滚）
       │                                                            │
       │                                                            ▼ APPROVE
       └──────────────────────────────────────────────────► MATERIAL_ARCHIVE（出闭环）
```

### 4.3 ⚠️ 关于 ADJUST 的现状：未接通的"死代码"

**事实清单**：

| 层 | 状态 |
|---|---|
| 后端 `review.handler.ts:195-228` | ✅ 实现了 ADJUST action（设 `skip_to_final=true`）|
| `seed.sql` transition 表 | ✅ 配置 `('FINAL_REVIEW','ON_SITE_ASSESSMENT','ADJUST')`|
| `seed.sql` FINAL_REVIEW.config | ✅ `{"reject_action":"ADJUST","reject_target":"ON_SITE_ASSESSMENT"}` |
| 前端 `status-map.ts` | ✅ 有"调整 / 已调整 / 最终审核调整"翻译 |
| **前端 `ReviewOpinionDialog.vue`** | ❌ **只有 APPROVE/REVIEW/REJECT 三按钮，没有 ADJUST 入口** |
| 业务代码里调用 signal(action='ADJUST') | ❌ **0 处**（前后端搜索均未发现）|

**结论：ADJUST 是后端预留好但前端从未接通的扩展点，当前没有任何业务场景能触发它。**

#### 推断的原始设计意图

从 transition + `skip_to_final` guard 的组合配置推断，开发者**当时**设想的 ADJUST 流程是：

> 最终审核员发现报告里"某测评字段不对"，但不至于整套重审 → PM 改测评数据 → **跳过 4 路质量审核**直达 REPORT_ASSIGN → 重新编制 + 最终审核

#### 业务讨论：ADJUST 放在 FINAL_REVIEW 还是 REPORT_COMPILE 更合适？

**放在 FINAL_REVIEW（现状设计意图）**：
- 优势：覆盖"最终审核员看出测评级别问题"的场景
- 劣势：最终审核员通常关注成果合规性 / 格式 / 结论，**不太精读测评数据细节**。这种场景实际较低频

**放在 REPORT_COMPILE（业务更典型的场景）**：
- 优势：报告编制员是**唯一逐字逐句使用测评数据的人**，最容易发现"这个字段错了""这个表缺一项"。在编制阶段触发 ADJUST 是高频自然场景
- 劣势：REPORT_COMPILE 已有 REVIEW 路径（任务变 PENDING_RECTIFICATION 给 PM）。如果加 ADJUST，要明确区分"小改报告本身"（REVIEW）vs"小改测评数据"（ADJUST），UI 需要慎重设计

**未来如要落地 ADJUST**：建议在 **REPORT_COMPILE 也加 ADJUST 入口**，不一定要把 FINAL_REVIEW 的 ADJUST 删掉（两个节点都能 ADJUST 是合理的，最终审核兜底）。

---

## 5. 关键操作 × 角色 矩阵

| 操作 | PM | 测评师 | tech_reviewer | content_reviewer_* | report_assigner | report_writer | dept_manager | 销售 | super_admin | chairman |
|---|---|---|---|---|---|---|---|---|---|---|
| 上传测评成果（ASSESSMENT_RESULT）| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 上传测评辅助资料（ASSESSOR_INPUT）| ✅ | ✅（自己的）| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **发起质量审核** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| TECH_REVIEW 操作 | ❌（回避）| ❌（回避）| ✅（非本项目）| ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| CONTENT_REVIEW 操作 | ❌（回避）| ❌（回避）| ❌ | ✅（对应 slot，非本项目）| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| REPORT_ASSIGN 操作（选编制人 + 通过）| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| REPORT_COMPILE 操作（上传报告 + 通过）| ❌ | ❌ | ❌ | ❌ | ❌ | ✅（被分配的那个）| ❌ | ❌ | ✅ | ❌ |
| FINAL_REVIEW 操作（APPROVE/REVIEW/REJECT）| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **整改后重新提交** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅（REPORT_COMPILE 的整改）| ❌ | ❌ | ✅ | ❌ |
| 看现场测评列表 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅（自己项目）| ✅ | ✅ |
| 看任务详情页 | ✅（看自己项目）| ✅ | ✅（自己任务）| ✅（自己任务）| ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 看审核历史（ReviewOpinion）| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 6. ⚠️ 边界场景与潜在问题

### 边界 1：回避后池里没人 — fallback 兜底

代码：`assignment.service.ts:113-118`

```ts
if (candidateUserIds.length === 0) {
  this.logger.warn('Avoidance left no candidates, falling back to first candidate');
  candidateUserIds = [...allCandidates];  // 原池（含被回避的）
}
```

如果某种角色的人全在当前项目里（如 tech_reviewer 只有 3 个，全是项目成员），会**兜底分配给本项目成员**（违反回避规则但避免流程卡死）。日志里有 warning，业务方需要意识到这种情况下质量保障会下降。

### 边界 2：CONTENT_REVIEW 的 REVIEW 让通过的人也要重审

如前所述，3 路并行任何一路点"复核"会触发全部 3 个任务变 PENDING_RECTIFICATION。已经通过的审核人 PM 整改后必须重新审。

设计逻辑：PM 整改可能影响整份成果。实现见 `parallel-review.handler.ts:86-101`。

### 边界 3：REVIEW 和 REJECT 的语义混淆

- **REVIEW（复核）** = 当前节点不变 → PM 整改 → 原审核人继续审 → 适合"小问题，改一下"
- **REJECT（驳回）** = 退回 ON_SITE_ASSESSMENT → 整个测评流程重启 round → 适合"测评本身有大问题"

前端按钮文案"驳回意见" vs "复核意见"做了区分（`ReviewOpinionDialog.vue:42-49`），审核人应能区分清楚。但**业务上确实有审核人会混淆两者**，需要培训时强调。

### 边界 4：FINAL_REVIEW REJECT 的实现绕过了 transition 表

代码：`workflow.service.ts:475-489` 检测到 FINAL_REVIEW + REJECT 时不走 advanceToNextNode（因为 transition 表里没配 REJECT 路径），而是直接 emit `workflow.node.completed`，让 `assessment.listener:35-44` 接管，调 `rejectToAssessment` 跳到 ON_SITE_ASSESSMENT。

**注释 bug**：`workflow.service.ts:475` 注释说"by assessment.listener.ts (rejectToTechReview)"，但实际调的是 `rejectToAssessment`。代码注释错了，行为是正确的。

### 边界 5：FINAL_REVIEW REVIEW 强制回到"原编制人"

代码：`workflow.service.ts:391-423`

如果 FINAL_REVIEW REVIEW → 回到 REPORT_COMPILE，**会强制把任务 assigneeId 改回 project_member 里的 REPORT_WRITER**，而不是 review.handler 默认走 sort_order 最小的 report_writer。

原因：业务上让原编制人改自己的报告比让别人改更合理。如果 project_member 里没有 REPORT_WRITER（异常情况），保留默认分配作为兜底。

### 边界 6：池任务被并发抢领

代码：`review.handler.ts:124-142` 用 `WHERE id=? AND status='PENDING'` 的 atomic update。没抢到的审核人会看到"该任务已被他人处理"提示。但**没刷新的人在待办列表里还会看到这条**，需要前端定时拉取或 SSE 推送优化体验。

### 边界 7：super_admin 看到所有池任务的越权风险

代码：`workflow.service.ts:531-533`。super_admin 看得到任何池任务（不管角色匹配不匹配）。误操作可能把别人的审核任务"代办"。建议任务详情页加二次确认。

### 边界 8：chairman 完全不在工作流分配中

代码：`workflow.service.ts:520-521` 明确说"chairman 不在任何 wf_assignment_rule 中"。董事长**任何审核任务都不会出现在他待办**，他只能去业务列表只读查看。

### 边界 9：ADJUST 是死代码（详见 4.3）

后端实现完整但前端没接通。当前业务流程不会触发。

---

## 7. 数据流：一次完整闭环的生命周期

以**项目 #42 走顺利全通过场景**为例：

```
T+0   PM 上传测评成果 → assessment_file (filePool='ASSESSMENT_RESULT')
T+1   PM 点"发起质量审核" → assessment.service.initiateQualityReview
       → workflow.signal SUBMIT × N (每个 ON_SITE_ASSESSMENT task)
       → 全部完成 → ALL_COMPLETE → 进 TECH_REVIEW
T+1   review.handler.onEnter → 创建 1 个 task (assigneeId=null)
       → 给所有 tech_reviewer（非本项目）发"新待办"
T+2   某 tech_reviewer 点"通过" → COMPLETED → 进 CONTENT_REVIEW
T+2   parallel-review.handler.onEnter → 创建 3 个 task：
       ├─ CONTENT_A → user 1 (content_reviewer_tech, 非本项目)
       ├─ CONTENT_B → user 2 (content_reviewer_mgmt, 非本项目)
       └─ CONTENT_C → user 3 (content_reviewer_network, 非本项目)
T+3~5 3 人各点"通过" → CONTENT_REVIEW ALL_APPROVED → 进 REPORT_ASSIGN
T+6   report_assigner 在 ReportWriterCard 选定编制人 user 4 + 点"通过"
       → report.listener 触发：
           1. project_member 写入 REPORT_WRITER (user 4)
           2. project_register.compiledBy = user 4
           3. 等 REPORT_COMPILE task 创建后改 assigneeId = user 4
T+7   user 4 在 REPORT_COMPILE 上传报告文件 + 点"通过"
       → 进 FINAL_REVIEW
T+8   dept_manager 收到"新待办：最终审核"
T+9   dept_manager 点"通过" → 出闭环 → 进 MATERIAL_ARCHIVE
```

wf_action_log 留下：
```
START         → instance 创建
SUBMIT × N    → ON_SITE_ASSESSMENT 完成
APPROVE       → TECH_REVIEW
APPROVE × 3   → CONTENT_REVIEW.A/B/C
ALL_APPROVED  → CONTENT_REVIEW 节点完成
APPROVE       → REPORT_ASSIGN
APPROVE       → REPORT_COMPILE
APPROVE       → FINAL_REVIEW (出闭环)
```

---

## 8. 关键文件索引

| 关注点 | 文件 | 关键行 |
|---|---|---|
| 工作流节点定义 + transition | `scripts/seed.sql` | 208-215 |
| 任务分配规则 | `scripts/seed.sql` | 226-232 |
| TECH_REVIEW / REPORT_ASSIGN / REPORT_COMPILE / FINAL_REVIEW 共用 | `packages/server/src/modules/workflow/handlers/review.handler.ts` | 全文 |
| CONTENT_REVIEW 并行处理 | `packages/server/src/modules/workflow/handlers/parallel-review.handler.ts` | 全文 |
| 现场测评协作 | `packages/server/src/modules/workflow/handlers/multi-assignee.handler.ts` | 全文 |
| PM 发起质量审核 | `packages/server/src/modules/assessment/assessment.service.ts` | 405-498 |
| PM 整改重新提交 | `packages/server/src/modules/workflow/workflow.service.ts` | 818-893 |
| FINAL_REVIEW REVIEW → REPORT_COMPILE 的特殊路径 | `packages/server/src/modules/workflow/workflow.service.ts` | 347-454 |
| FINAL_REVIEW REJECT 拦截 | `packages/server/src/modules/workflow/workflow.service.ts` | 475-489 |
| FINAL_REVIEW REJECT 实际跳转 | `packages/server/src/modules/assessment/assessment.listener.ts` | 35-44 |
| `rejectToAssessment` 实现 | `packages/server/src/modules/workflow/workflow.service.ts` | 989-1071 |
| REPORT_ASSIGN APPROVE 后写入编制人 | `packages/server/src/modules/report/report.listener.ts` | 33-86 |
| 待办中心可见性 | `packages/server/src/modules/workflow/workflow.service.ts` | 508-708 |
| 项目列表可见性 | `packages/server/src/modules/assessment/assessment.service.ts` | 32-110 |
| 池任务回避规则 | `packages/server/src/modules/workflow/assignment.service.ts` | 79-138 |
| 任务详情页（前端）| `packages/web/src/pages/workflow/TaskDetail.vue` | 75/80 等 computed |
| 审核意见弹窗 | `packages/web/src/components/ReviewOpinionDialog.vue` | 42-78 |

---

## 9. 一句话总结

**ON_SITE_ASSESSMENT 是入口，FINAL_REVIEW 是闭环出口。**

- PM 通过"发起质量审核"启动闭环
- 4 路审核（TECH + 3 路 CONTENT）→ 报告分配 → 报告编制 → 最终审核
- 最终审核的 3 条驳回路径（REVIEW / REJECT / ADJUST）覆盖了不同程度的回滚
- 通过 APPROVE 离开闭环，进入 MATERIAL_ARCHIVE 进行业务归档
- ADJUST 当前是死代码，未来落地建议加在 REPORT_COMPILE（更高频更贴合业务）
