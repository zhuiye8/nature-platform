# 回归清单执行报告（2026-02-12）

## 1. 执行范围
对 `docs/REGRESSION_CHECKLIST.md` 的 A-E 项逐项执行并记录结果。

## 2. 执行命令（可复现）
1. 全量 API E2E
```powershell
powershell -ExecutionPolicy Bypass -File C:\work\nature\codex\deploy\e2e\api\run-all.ps1
```
2. 账号与角色核验（A）
```powershell
. C:\work\nature\codex\deploy\e2e\lib\common.ps1
$ctx=New-E2EContext -SuiteName 'tmp-auth-check' -BaseUrl 'http://127.0.0.1:18080'
$adminToken=Login-E2EToken -Context $ctx -Username 'admin' -Password 'admin123'
$normalToken=Login-E2EToken -Context $ctx -Username 'normal' -Password 'normal123'
Invoke-E2EApi -Context $ctx -Method 'Get' -Path '/api/v1/auth/me' -Token $adminToken
Invoke-E2EApi -Context $ctx -Method 'Get' -Path '/api/v1/auth/me' -Token $normalToken
```
3. 回收站恢复成功/冲突核验（B-3）
```powershell
# 已执行临时脚本流：创建合同+项目 -> 删除 -> 恢复(200) -> 再删并新建同合同同年份 -> 恢复(409)
# 关键结果：restoreSuccess=200, restoreConflict=409
```
4. 待办权限核验（D）
```powershell
# 已执行临时脚本流：创建待审核合同任务后，比较 reviewer/normal 的 /workflow/tasks/todo
# 关键结果：reviewerMatchedContractTask=1, normalMatchedContractTask=0
```

## 3. 清单结果
1. A. 账号与角色：通过
   - `admin` 的 `/auth/me` 包含 `ROLE_SUPER_ADMIN`
   - `normal` 的 `/auth/me` 不包含 `ROLE_SUPER_ADMIN`
2. B. 回收站权限：通过
   - 非超管恢复：`403`（`recycle-bin-forbidden.ps1`）
   - 超管恢复无冲突：`200`（临时核验）
   - 超管恢复冲突：`409`，消息 `restore conflict: same contract-year active record exists`（临时核验）
3. C. 现场测评分配（角色池）：通过
   - `reviewer-candidates.ps1` 断言四组候选数组均存在
   - Playwright 用例断言分配弹窗四下拉分别绑定 `报告技术 + 内容技术/管理/网络` 候选池
   - Playwright 用例断言未选齐 4 人时阻断保存（请求未发出）
4. D. 待办审批权限：通过
   - `reviewer` 可见合同待办（匹配数 1）
   - `normal` 不可见同一合同待办（匹配数 0）
   - 超管可处理审核任务（已在 API E2E 正向/异常链路中多次 approve/reject 通过）
5. E. 构建与测试：通过
   - `mvn -q test` 通过
   - `pnpm build` 通过
   - `check_format_doc.py --mode changed --allow-missing-architecture` 通过

## 4. 关键证据
- API 报告目录：`deploy/e2e/reports/api`
- 本轮新增关键报告：
  - `exception-report-tech-reject-recovery-20260212-141548.json`
  - `exception-report-final-reject-recovery-20260212-141549.json`
  - `happy-path-project-police-onsite-assignment-20260212-141551.json`


