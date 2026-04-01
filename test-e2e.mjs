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

  // ── 13. 中文编码验证 ──
  console.log('\n【13】中文编码验证');
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
