import http from 'node:http';

function api(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost', port: 3010, path: '/api' + path, method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✅ ' + name + (detail ? ' → ' + detail : '')); }
  else    { fail++; console.log('  ❌ ' + name + (detail ? ' → ' + detail : '')); }
}

async function main() {
  console.log('========================================');
  console.log('Nature 等保测评平台 — 全链路可用性测试');
  console.log('========================================\n');

  // ── 1. 认证 ──
  console.log('【1】认证模块');
  const login = await api('POST', '/auth/login', null, { username: 'admin', password: 'admin123' });
  check('登录 admin/admin123', login.code === 0, 'displayName=' + login.data?.user?.displayName);
  const token = login.data?.accessToken;

  const me = await api('GET', '/auth/me', token);
  check('获取当前用户 /auth/me', me.code === 0, 'username=' + me.data?.username);

  const badLogin = await api('POST', '/auth/login', null, { username: 'admin', password: 'wrong' });
  check('错误密码被拒绝', badLogin.code !== 0);

  const noAuth = await api('GET', '/customer/page', null);
  check('无Token请求被拦截(401)', noAuth.code === 401 || noAuth.code === 40001);

  // ── 2. 客户 CRUD ──
  console.log('\n【2】客户管理 CRUD');
  const c1 = await api('POST', '/customer', token, { fullName: '江苏省人民医院', industry: '医疗卫生', contactName: '张明', mobilePhone: '13912345001', isGovernment: false, remark: '三甲医院' });
  check('创建客户-医院', c1.code === 0, 'id=' + c1.data?.id + ' name=' + c1.data?.fullName);
  const custId1 = c1.data?.id;

  const c2 = await api('POST', '/customer', token, { fullName: '南京市网络安全管理中心', industry: '政府单位', contactName: '王刚', mobilePhone: '13912345002', isGovernment: true });
  check('创建客户-政府', c2.code === 0, 'isGovernment=' + c2.data?.isGovernment);
  const custId2 = c2.data?.id;

  const c3 = await api('POST', '/customer', token, { fullName: '扬州大学信息化中心', industry: '教育科研', contactName: '李莉', mobilePhone: '13912345003', isGovernment: false });
  check('创建客户-高校', c3.code === 0);

  const cList = await api('GET', '/customer/page?page=1&pageSize=10', token);
  check('客户分页列表', cList.code === 0 && cList.data?.total >= 3, 'total=' + cList.data?.total);

  const cSearch = await api('GET', '/customer/page?keyword=' + encodeURIComponent('医院'), token);
  check('搜索"医院"', cSearch.code === 0 && cSearch.data?.total >= 1, 'found=' + cSearch.data?.total);

  const cUpdate = await api('PUT', '/customer/' + custId1, token, { contactName: '张明远', remark: '三甲医院-VIP客户' });
  check('更新客户联系人', cUpdate.code === 0, 'contactName=' + cUpdate.data?.contactName);

  const cDetail = await api('GET', '/customer/' + custId1, token);
  check('客户详情', cDetail.code === 0 && cDetail.data?.remark === '三甲医院-VIP客户', 'remark=' + cDetail.data?.remark);

  // ── 3. 合同 ──
  console.log('\n【3】合同管理 + 工作流');
  const ct1 = await api('POST', '/contract', token, {
    customerId: custId1,
    projectName: '江苏省人民医院2026年等保测评',
    bidAmount: '120000',
    paymentAmount: '108000',
    serviceYears: [2026],
    systemItems: [
      { systemName: '门诊管理系统', systemLevel: '3', sortOrder: 1 },
      { systemName: '住院管理系统', systemLevel: '3', sortOrder: 2 },
      { systemName: '电子病历系统', systemLevel: '2', sortOrder: 3 },
    ],
  });
  check('创建合同（3个系统）', ct1.code === 0, 'id=' + ct1.data?.id);
  const contractId = ct1.data?.id;

  const ctDetail = await api('GET', '/contract/' + contractId, token);
  check('合同详情（含系统明细）', ctDetail.code === 0 && ctDetail.data?.systemItems?.length === 3, 'systems=' + ctDetail.data?.systemItems?.length);

  const ctSubmit = await api('POST', '/contract/' + contractId + '/submit', token);
  check('提交合同审核', ctSubmit.code === 0);

  // ── 4. 工作流审批 ──
  console.log('\n【4】工作流引擎');
  let tasks = await api('GET', '/workflow/my-tasks', token);
  check('待办任务列表', tasks.code === 0 && tasks.data?.length > 0, 'count=' + tasks.data?.length);

  // Signal CONTRACT_CREATE
  const createTask = tasks.data?.find(t => t.nodeKey === 'CONTRACT_CREATE');
  if (createTask) {
    const sig1 = await api('POST', '/workflow/signal', token, { instanceId: createTask.instanceId, taskId: createTask.id, action: 'SUBMIT', remark: '合同信息已确认' });
    check('信号：提交合同创建节点', sig1.code === 0);

    // Signal CONTRACT_REVIEW (approve)
    tasks = await api('GET', '/workflow/my-tasks', token);
    const reviewTask = tasks.data?.find(t => t.nodeKey === 'CONTRACT_REVIEW');
    if (reviewTask) {
      const sig2 = await api('POST', '/workflow/signal', token, { instanceId: reviewTask.instanceId, taskId: reviewTask.id, action: 'APPROVE', remark: '合同审核通过' });
      check('信号：审核通过', sig2.code === 0);

      // Verify auto-generated contract number
      const ctAfter = await api('GET', '/contract/' + contractId, token);
      check('自动生成合同编号', !!ctAfter.data?.contractNo, 'contractNo=' + ctAfter.data?.contractNo);
      check('自动生成合同名称', !!ctAfter.data?.contractName, 'contractName=' + ctAfter.data?.contractName);
      check('合同状态→APPROVED', ctAfter.data?.reviewStatus === 'APPROVED', 'status=' + ctAfter.data?.reviewStatus);

      // Check archive task
      tasks = await api('GET', '/workflow/my-tasks', token);
      const archiveTask = tasks.data?.find(t => t.nodeKey === 'CONTRACT_ARCHIVE');
      if (archiveTask) {
        const sig3 = await api('POST', '/workflow/signal', token, { instanceId: archiveTask.instanceId, taskId: archiveTask.id, action: 'SUBMIT', remark: '合同已归档' });
        check('信号：合同归档完成', sig3.code === 0);
      } else {
        check('合同归档任务存在', false, '未找到 CONTRACT_ARCHIVE 任务');
      }

      // Verify workflow completed
      const inst = await api('GET', '/workflow/instance/biz/CONTRACT/' + contractId, token);
      check('合同工作流已完成', inst.data?.status === 'COMPLETED', 'status=' + inst.data?.status);
    }
  }

  // ── 5. 用户管理 ──
  console.log('\n【5】用户管理');
  const u1 = await api('POST', '/user', token, { username: 'wangli', password: 'wang123456', displayName: '王丽', mobile: '13900001111' });
  check('创建用户-王丽', u1.code === 0);

  const u2 = await api('POST', '/user', token, { username: 'zhaoliu', password: 'zhao123456', displayName: '赵六', mobile: '13900002222' });
  check('创建用户-赵六', u2.code === 0);

  const dupUser = await api('POST', '/user', token, { username: 'admin', password: 'test123', displayName: '重复' });
  check('重复用户名被拒绝', dupUser.code !== 0);

  const assign1 = await api('PUT', '/user/' + u1.data?.id + '/assign-roles', token, { roleCodes: ['project_manager', 'tech_reviewer'] });
  check('分配角色（PM+技术审核）', assign1.code === 0);

  const assign2 = await api('PUT', '/user/' + u2.data?.id + '/assign-roles', token, { roleCodes: ['assessor', 'content_reviewer_tech'] });
  check('分配角色（测评师+内容审核）', assign2.code === 0);

  const uDetail = await api('GET', '/user/' + u1.data?.id, token);
  check('用户详情含角色', uDetail.data?.roles?.length === 2, 'roles=' + JSON.stringify(uDetail.data?.roles));

  const uSimple = await api('GET', '/user/simple-list', token);
  check('用户下拉列表', uSimple.code === 0 && uSimple.data?.length >= 3, 'count=' + uSimple.data?.length);

  const resetPwd = await api('PUT', '/user/' + u2.data?.id + '/reset-password', token, { newPassword: 'newpass123' });
  check('重置密码', resetPwd.code === 0);

  // Verify new password works
  const loginNew = await api('POST', '/auth/login', null, { username: 'zhaoliu', password: 'newpass123' });
  check('新密码登录成功', loginNew.code === 0, 'displayName=' + loginNew.data?.user?.displayName);

  // ── 6. 角色管理 ──
  console.log('\n【6】角色管理');
  const roles = await api('GET', '/role/list', token);
  check('角色列表', roles.code === 0 && roles.data?.length >= 12, 'count=' + roles.data?.length);

  const perms = await api('GET', '/role/all-permissions', token);
  const permCategories = Object.keys(perms.data || {});
  check('权限分组列表', permCategories.length > 0, 'categories=' + permCategories.join(','));

  const newRole = await api('POST', '/role', token, { roleCode: 'test_auditor', roleName: '测试审计员', description: '用于测试的自定义角色' });
  check('创建自定义角色', newRole.code === 0, 'roleCode=' + newRole.data?.roleCode);

  if (newRole.data?.id) {
    const delRole = await api('DELETE', '/role/' + newRole.data.id, token);
    check('删除自定义角色', delRole.code === 0);
  }

  // ── 7. 公安登记 ──
  console.log('\n【7】公安登记');
  const pol = await api('POST', '/police', token, {
    projectRegisterId: 999, projectManagerId: u1.data?.id,
    registerNo: 'GA-JS-2026-00001', filingAgency: '江苏省公安厅网安总队',
    contactName: '陈警官', contactPhone: '025-83588888', remark: '已联系备案受理窗口',
  });
  check('创建公安登记', pol.code === 0, 'registerNo=' + pol.data?.registerNo);

  const polList = await api('GET', '/police/page', token);
  check('公安登记列表', polList.code === 0, 'total=' + polList.data?.total);

  const pmDropdown = await api('GET', '/police/project-managers', token);
  check('项目经理下拉（含已分配PM的用户）', pmDropdown.code === 0, 'count=' + pmDropdown.data?.length);

  if (pol.data?.id) {
    const polComplete = await api('POST', '/police/' + pol.data.id + '/complete', token);
    check('完成公安登记', polComplete.code === 0);

    const polAfter = await api('GET', '/police/' + pol.data.id, token);
    check('状态变为COMPLETED', polAfter.data?.status === 'COMPLETED', 'status=' + polAfter.data?.status);
  }

  // ── 8. 回收站 ──
  console.log('\n【8】回收站');
  const recyclePage = await api('GET', '/recycle/page?bizType=CONTRACT', token);
  check('回收站（合同）', recyclePage.code === 0, 'total=' + recyclePage.data?.total);

  // ── 9. 现场测评 ──
  console.log('\n【9】现场测评');
  const assessPage = await api('GET', '/assessment/page', token);
  check('测评列表', assessPage.code === 0, 'total=' + assessPage.data?.total);

  // ── 10. 报告管理 ──
  console.log('\n【10】报告管理');
  const reportPage = await api('GET', '/report/page', token);
  check('报告列表', reportPage.code === 0, 'total=' + reportPage.data?.total);

  // ── 11. 材料归档 ──
  console.log('\n【11】材料归档');
  const archivePage = await api('GET', '/archive/page', token);
  check('归档列表', archivePage.code === 0, 'total=' + archivePage.data?.total);

  // ── 12. 通知 ──
  console.log('\n【12】通知系统');
  const unread = await api('GET', '/notification/unread-count', token);
  check('未读通知数', unread.code === 0, 'count=' + JSON.stringify(unread.data));

  const notifList = await api('GET', '/notification?page=1&pageSize=10', token);
  check('通知列表', notifList.code === 0);

  // ── 13. DIRECTOR_REVIEW 事务化冒烟测试（覆盖 project.listener 事务化改动）──
  // 目标：走完 项目登记 → 提交 → (DEPT_REVIEW) → DIRECTOR_REVIEW 分配 PM/测评师 →
  //       验证 project.listener 事务化的 4 项副作用全部落地：
  //       1. project.status = APPROVED
  //       2. project_system_item.systemNo 生成
  //       3. project_member 插入 PM
  //       4. project_member 插入 ASSESSOR
  //       5. police.listener 独立事件：police_register 自动创建 status=PENDING
  // 前置：contractId (Section 3) 已 APPROVED；u1/u2 (Section 5) 已存在
  // 容错：后端 listener 不校验测评师角色 (只要 userId 合法就入库)，
  //       故此处用 u1 作 PM、u2 作 assessor 无需额外角色分配
  // 降级：任一前置失败则跳过后续断言，打印诊断，不崩溃
  console.log('\n【13】DIRECTOR_REVIEW 事务化冒烟测试');
  let projectId = null;

  // 动态寻找一个 APPROVED 合同：优先用 Section 3 的 ct1，回退到数据库已有
  // 这样即使 Section 3 失败 (重复创建冲突等)，本 Section 仍能独立运行
  let useContractId = contractId;
  if (!useContractId) {
    const apprList = await api('GET', '/contract/page?reviewStatus=APPROVED&pageSize=5', token);
    useContractId = apprList.data?.list?.find(c => c.serviceYears?.includes(2026))?.id
      ?? apprList.data?.list?.[0]?.id;
    if (useContractId) {
      console.log('  ℹ️  Section 3 ct1 不可用，回退到已有合同 id=' + useContractId);
    }
  }

  // 获取 PM 和 assessor 候选：优先用 Section 5 创建的，回退到现有用户池
  // (后端 listener 不校验 assessor 角色，只要 userId 合法即可)
  let pmId = u1.data?.id;
  let assessorId = u2.data?.id;
  if (!pmId || !assessorId) {
    const uAll = await api('GET', '/user/simple-list', token);
    const pool = (uAll.data || []).filter(u => u.username !== 'admin');
    pmId = pmId ?? pool[0]?.id;
    assessorId = assessorId ?? pool.find(u => u.id !== pmId)?.id;
    if (pmId && assessorId) {
      console.log('  ℹ️  Section 5 用户不可用，回退到现有用户 PM=' + pmId + ' assessor=' + assessorId);
    }
  }

  if (!useContractId || !pmId || !assessorId) {
    console.log('  ⚠️  前置缺失 (contract=' + useContractId + ' pm=' + pmId + ' assessor=' + assessorId + ')，整个 Section 跳过');
  } else {
    // 拿合同详情以确定 contractYear + 客户信息填 systemItem
    const ctDetail = await api('GET', '/contract/' + useContractId, token);
    const useYear = ctDetail.data?.serviceYears?.[0] ?? 2026;

    // Step 1: 创建项目登记
    const projCreate = await api('POST', '/project', token, {
      contractId: useContractId, contractYear: useYear,
      applicationName: 'E2E测试-事务化-' + Date.now(),
    });
    check('项目登记创建', projCreate.code === 0,
      projCreate.code !== 0 ? 'msg=' + JSON.stringify(projCreate).slice(0, 180) : 'id=' + projCreate.data?.id);
    projectId = projCreate.data?.id;

    if (projectId) {
      // Step 2: 补充系统明细 (必填字段齐全，否则 submit 会被 service 层拦住)
      const projUpdate = await api('PUT', '/project/' + projectId, token, {
        systemItems: [{
          clientKey: 'ck_e2e_1',
          systemName: 'E2E测试-HIS系统',
          filingAgency: '扬州市公安局',
          securityLevel: '三级',
          assessedUnitName: '江苏省人民医院',
          assessedUnitContact: '张明远',
          assessedUnitMobile: '13900001234',
          assessedUnitAddress: '南京市玄武区',
          hasFilingCertificate: true,
          filingCertificateNo: 'FILE-E2E-001',
          filingCertificateIssuedAt: '2026-01-15',
          requiredEntryDate: '2026-03-01',
          requiredReportDeliveryDate: '2026-06-01',
          sortOrder: 1,
        }],
      });
      check('添加系统明细', projUpdate.code === 0,
        projUpdate.code !== 0 ? 'msg=' + JSON.stringify(projUpdate).slice(0, 180) : '');

      // Step 3: 提交审核
      const subRes = await api('POST', '/project/' + projectId + '/submit', token);
      check('提交项目登记审核', subRes.code === 0,
        subRes.code !== 0 ? 'msg=' + JSON.stringify(subRes).slice(0, 180) : '');

      if (subRes.code === 0) {
        // Step 4: 推进 DEPT_REVIEW (合同未归档时出现)
        let projTasks = await api('GET', '/workflow/my-tasks', token);
        const deptTask = projTasks.data?.find(
          t => t.nodeKey === 'DEPT_REVIEW' && t.bizId === projectId);
        if (deptTask) {
          const sigDept = await api('POST', '/workflow/signal', token, {
            instanceId: deptTask.instanceId, taskId: deptTask.id,
            action: 'APPROVE', remark: 'E2E 部门经理准入',
          });
          check('DEPT_REVIEW 通过', sigDept.code === 0,
            sigDept.code !== 0 ? 'msg=' + JSON.stringify(sigDept).slice(0, 120) : '');
        } else {
          console.log('  ℹ️  未出现 DEPT_REVIEW (合同已归档，跳过此步属正常)');
        }

        // Step 5: 推进 DIRECTOR_REVIEW + 分配 PM/测评师
        projTasks = await api('GET', '/workflow/my-tasks', token);
        const dirTask = projTasks.data?.find(
          t => t.nodeKey === 'DIRECTOR_REVIEW' && t.bizId === projectId);
        check('DIRECTOR_REVIEW 任务已生成', !!dirTask,
          dirTask ? 'taskId=' + dirTask.id : '未找到，流程异常');

        if (dirTask) {
          const sigDir = await api('POST', '/workflow/signal', token, {
            instanceId: dirTask.instanceId, taskId: dirTask.id,
            action: 'APPROVE', remark: 'E2E 项目主管分配 PM + 测评师',
            extraData: {
              pmUserId: pmId,
              assessorUserIds: [assessorId],
            },
          });
          check('DIRECTOR_REVIEW APPROVE + 分配', sigDir.code === 0,
            sigDir.code !== 0 ? 'msg=' + JSON.stringify(sigDir).slice(0, 180) : '');

          if (sigDir.code === 0) {
            // Step 6: listener 异步执行，等待完成
            await new Promise(r => setTimeout(r, 1500));

            // Step 7: 验证 project.listener 事务化的 4 项产物
            const projAfter = await api('GET', '/project/' + projectId, token);
            check('[TX] project.status → APPROVED',
              projAfter.data?.status === 'APPROVED',
              'status=' + projAfter.data?.status);

            const sysItems = projAfter.data?.systemItems || [];
            check('[TX] systemNo 已生成 (事务内)',
              sysItems.length > 0 && sysItems.every(s => !!s.systemNo),
              sysItems[0] ? '样例=' + sysItems[0].systemNo : '无明细');

            const members = projAfter.data?.members || [];
            const pm = members.find(m => m.roleType === 'PM');
            const assessors = members.filter(m => m.roleType === 'ASSESSOR');
            check('[TX] PM 入 project_member',
              pm?.userId === pmId,
              'pm=' + JSON.stringify(pm));
            check('[TX] ASSESSOR 入 project_member',
              assessors.length === 1 && assessors[0].userId === assessorId,
              'count=' + assessors.length);

            // Step 8: police.listener 独立事件 — 验证 police_register 自动创建
            const polList2 = await api('GET', '/police/page?status=PENDING&pageSize=50', token);
            const autoPol = polList2.data?.list?.find(
              p => p.projectRegisterId === projectId);
            check('police_register 自动创建 (status=PENDING)',
              !!autoPol, autoPol ? 'id=' + autoPol.id : '未找到对应记录');
          }
        }
      }
    }
  }

  // ── 14. 中文编码验证 ──
  console.log('\n【14】中文编码验证');
  const cnCustomer = await api('GET', '/customer/' + custId1, token);
  check('中文客户名完整', cnCustomer.data?.fullName === '江苏省人民医院', 'name=' + cnCustomer.data?.fullName);
  check('中文联系人完整', cnCustomer.data?.contactName === '张明远', 'contact=' + cnCustomer.data?.contactName);
  check('中文备注完整', cnCustomer.data?.remark === '三甲医院-VIP客户', 'remark=' + cnCustomer.data?.remark);

  // ── Summary ──
  console.log('\n========================================');
  console.log('  测试结果：✅ ' + pass + ' 通过 / ❌ ' + fail + ' 失败 / 共 ' + (pass + fail) + ' 项');
  console.log('========================================');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
