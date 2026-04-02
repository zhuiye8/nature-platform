import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/pages/ProfilePage.vue'),
        meta: { title: '个人中心' },
      },
      {
        path: 'customer',
        name: 'CustomerList',
        component: () => import('@/pages/customer/CustomerList.vue'),
        meta: { title: '客户管理', permission: 'customer:list' },
      },
      {
        path: 'customer/:id',
        name: 'CustomerDetail',
        component: () => import('@/pages/customer/CustomerDetail.vue'),
        meta: { title: '客户详情', permission: 'customer:list' },
      },
      {
        path: 'contract',
        name: 'ContractList',
        component: () => import('@/pages/contract/ContractList.vue'),
        meta: { title: '合同管理', permission: 'contract:list' },
      },
      {
        path: 'contract/create',
        name: 'ContractCreate',
        component: () => import('@/pages/contract/ContractForm.vue'),
        meta: { title: '新建合同', permission: 'contract:create' },
      },
      {
        path: 'contract/:id',
        name: 'ContractDetail',
        component: () => import('@/pages/contract/ContractDetail.vue'),
        meta: { title: '合同详情', permission: 'contract:list' },
      },
      {
        path: 'contract/:id/edit',
        name: 'ContractEdit',
        component: () => import('@/pages/contract/ContractForm.vue'),
        meta: { title: '编辑合同', permission: 'contract:update' },
      },
      {
        path: 'project',
        name: 'ProjectList',
        component: () => import('@/pages/project/ProjectList.vue'),
        meta: { title: '项目登记', permission: 'project:list' },
      },
      {
        path: 'project/create',
        name: 'ProjectCreate',
        component: () => import('@/pages/project/ProjectForm.vue'),
        meta: { title: '新建项目登记', permission: 'project:create' },
      },
      {
        path: 'project/:id',
        name: 'ProjectDetail',
        component: () => import('@/pages/project/ProjectDetail.vue'),
        meta: { title: '项目详情', permission: 'project:list' },
      },
      {
        path: 'project/:id/edit',
        name: 'ProjectEdit',
        component: () => import('@/pages/project/ProjectForm.vue'),
        meta: { title: '编辑项目登记', permission: 'project:update' },
      },
      // --- 现场测评 ---
      {
        path: 'assessment',
        name: 'AssessmentList',
        component: () => import('@/pages/assessment/AssessmentList.vue'),
        meta: { title: '测评实施', permission: 'assessment:list' },
      },
      {
        path: 'assessment/:projectRegisterId',
        name: 'AssessmentDetail',
        component: () => import('@/pages/assessment/AssessmentDetail.vue'),
        meta: { title: '测评详情', permission: 'assessment:list' },
      },
      // --- 公安登记 ---
      {
        path: 'police',
        name: 'PoliceList',
        component: () => import('@/pages/police/PoliceList.vue'),
        meta: { title: '公安登记', permission: 'police:list' },
      },
      {
        path: 'police/:id',
        name: 'PoliceDetail',
        component: () => import('@/pages/police/PoliceDetail.vue'),
        meta: { title: '公安登记详情', permission: 'police:list' },
      },
      // --- 报告管理 ---
      {
        path: 'report',
        name: 'ReportList',
        component: () => import('@/pages/report/ReportList.vue'),
        meta: { title: '报告管理', permission: 'report:list' },
      },
      {
        path: 'report/:projectRegisterId',
        name: 'ReportDetail',
        component: () => import('@/pages/report/ReportDetail.vue'),
        meta: { title: '报告详情', permission: 'report:list' },
      },
      // --- 材料归档 ---
      {
        path: 'archive',
        name: 'ArchiveList',
        component: () => import('@/pages/archive/ArchiveList.vue'),
        meta: { title: '材料归档', permission: 'archive:list' },
      },
      {
        path: 'archive/:projectRegisterId',
        name: 'ArchiveDetail',
        component: () => import('@/pages/archive/ArchiveDetail.vue'),
        meta: { title: '材料归档详情', permission: 'archive:list' },
      },
      // --- 系统管理 ---
      {
        path: 'system/users',
        name: 'UserList',
        component: () => import('@/pages/system/UserList.vue'),
        meta: { title: '用户管理', permission: 'user:list' },
      },
      {
        path: 'system/roles',
        name: 'RoleList',
        component: () => import('@/pages/system/RoleList.vue'),
        meta: { title: '角色管理', permission: 'role:list' },
      },
      {
        path: 'system/recycle',
        name: 'RecycleBin',
        component: () => import('@/pages/system/RecycleBin.vue'),
        meta: { title: '回收站', permission: 'recycle:list' },
      },
      {
        path: 'system/partners',
        name: 'PartnerList',
        component: () => import('@/pages/system/PartnerList.vue'),
        meta: { title: '合作方管理', permission: 'partner:list' },
      },
      {
        path: 'workflow/task/:taskId',
        name: 'TaskDetail',
        component: () => import('@/pages/workflow/TaskDetail.vue'),
        meta: { title: '任务详情' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  if (to.meta.public) {
    next()
    return
  }

  const authStore = useAuthStore()

  if (!authStore.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // Token exists but user profile not loaded yet
  if (!authStore.user) {
    try {
      await authStore.fetchProfile()
    } catch {
      authStore.logout()
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
})

export default router
