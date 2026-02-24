# 回归检查清单（最小闭环）

## A. 账号与角色
1. 使用 `admin` 登录。
2. 调用 `GET /api/v1/auth/me`，确认包含 `ROLE_SUPER_ADMIN`。
3. 使用非超管账号登录，确认不包含 `ROLE_SUPER_ADMIN`。

## B. 回收站权限
1. 非超管进入“回收站”页面，恢复按钮应禁用。
2. 非超管直调恢复接口：应返回 `403`。
3. 超管执行恢复：无冲突应成功；有 `contract_id + contract_year` 冲突应返回 `409`。

## C. 现场测评审核人分配（角色池）
1. 进入“现场测评”，调用 `GET /api/v1/on-site-assessments/reviewer-candidates`。
2. 响应应包含四组数组：
   - `techReviewers`
   - `contentReviewersA`
   - `contentReviewersB`
   - `contentReviewersC`
3. 前端四个下拉应分别使用对应数组，不可混用。
4. 任一角色未选时提交分配应被阻止。

## D. 待办审批权限
1. 无审核角色用户访问“待办审批”中合同/项目审核项应受限。
2. `ROLE_REVIEWER` 或 `ROLE_SUPER_ADMIN` 用户可正常看到并处理审核。

## E. 基础构建与测试
1. 后端：`mvn -q test` 通过。
2. 前端：`pnpm build` 通过。
3. 文档检查：`check_format_doc.py --mode changed --allow-missing-architecture` 通过。
