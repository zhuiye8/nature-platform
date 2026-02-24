# 时间与通知一致性巡检报告（2026-02-12）

## 1. 巡检范围
1. 合同审核通过通知触发
2. 合同归档完成通知触发
3. 通知列表与未读计数一致性
4. 前端时间格式化是否统一使用 `Asia/Shanghai`

## 2. 巡检方式
- 自动脚本：`deploy/e2e/api/exception/notification-trigger-audit.ps1`
- 辅助脚本：`deploy/e2e/api/exception/notification-unread-delete.ps1`
- 静态代码检查：`nature-platform-web/src/time.ts`

## 3. 巡检结论
1. 合同审核通过通知：通过
   - 事件类型：`CONTRACT_REVIEW_APPROVED`
   - `reviewer` 通知列表可检索到对应 `refId`
2. 合同归档完成通知：通过
   - 事件类型：`CONTRACT_ARCHIVED`
   - 合同创建人（本用例为 `admin`）通知列表可检索到对应 `refId`
3. 未读计数一致性：通过
   - 插入未读通知后计数增加
   - 删除未读通知后计数实时减 1
4. 时间格式统一性：通过（代码级）
   - `time.ts` 包含 `timeZone: "Asia/Shanghai"`
   - 兼容后端无时区时间串时，追加 `+08:00` 做统一解析

## 4. 风险与建议
1. 当前已补齐页面级抽样清单（仪表盘/回收站/流程页），详见 `docs/reports/TIME_UI_SPOTCHECK_2026-02-12.md`。
2. 若进入 CI 阶段，建议补充截图比对或 DOM 文本快照断言，进一步提升时间渲染回归灵敏度。
