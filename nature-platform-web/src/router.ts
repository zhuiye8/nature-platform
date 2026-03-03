/**
 * @input vue-router APIs, auth store token/resource state, and centralized navigation metadata
 * @output Router instance with auth guard, resource guard, and route-level lazy loading metadata (including unified task-detail route)
 * @position Frontend navigation layer enforcing authenticated and page-resource-aware route access with review detail navigation support
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { ElMessage } from "element-plus";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "./auth-store";
import { navItems } from "./navigation";

const viewMap: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("./DashboardView.vue"),
  "/workflow": () => import("./WorkflowView.vue"),
  "/customers": () => import("./CustomersView.vue"),
  "/contract-submissions": () => import("./ContractSubmissionsView.vue"),
  "/contract-archives": () => import("./ContractArchivesView.vue"),
  "/project-registers": () => import("./ProjectRegistersView.vue"),
  "/police-registers": () => import("./PoliceRegistersView.vue"),
  "/on-site-assessment-executions": () => import("./OnSiteAssessmentsView.vue"),
  "/on-site-assessment-results": () => import("./OnSiteAssessmentsView.vue"),
  "/report-tech-reviews": () => import("./ReportTechReviewsView.vue"),
  "/report-content-reviews": () => import("./ReportContentReviewsView.vue"),
  "/report-compile-assignments": () => import("./ReportCompileAssignmentsView.vue"),
  "/report-compile-submissions": () => import("./ReportCompileSubmissionsView.vue"),
  "/report-final-reviews": () => import("./ReportFinalReviewsView.vue"),
  "/material-archives": () => import("./MaterialArchivesView.vue"),
  "/admin-users": () => import("./AdminUsersView.vue"),
  "/admin-departments": () => import("./AdminDepartmentsView.vue"),
  "/admin-roles": () => import("./AdminRolesView.vue"),
  "/admin-resources": () => import("./AdminResourcesView.vue"),
  "/admin-workflow": () => import("./AdminWorkflowView.vue"),
  "/admin-audit-logs": () => import("./AdminAuditLogsView.vue"),
  "/recycle-bin": () => import("./RecycleBinView.vue"),
  "/entity-detail": () => import("./EntityDetailView.vue")
};

const businessRoutes: RouteRecordRaw[] = navItems
  .map((item) => {
    const component = viewMap[item.path];
    if (!component) {
      return null;
    }
    return {
      path: item.path,
      component,
      meta: {
        title: item.label,
        resourceKey: item.resourceKey
      }
    } as RouteRecordRaw;
  })
  .filter((item): item is RouteRecordRaw => item !== null);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("./LoginView.vue"), meta: { public: true, title: "登录" } },
    { path: "/", redirect: "/dashboard" },
    { path: "/contracts", redirect: "/contract-submissions" },
    { path: "/on-site-assessments", redirect: "/on-site-assessment-results" },
    { path: "/admin-permissions", redirect: "/admin-resources" },
    {
      path: "/entity-detail/:entityType/:id",
      component: () => import("./EntityDetailView.vue"),
      meta: { title: "业务详情" }
    },
    { path: "/task-detail/:taskType/:bizId", component: () => import("./TaskDetailView.vue"), meta: { title: "审核详情" } },
    ...businessRoutes
  ]
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (to.meta.public) {
    return true;
  }
  if (!authStore.token) {
    return "/login";
  }
  const requiredResourceKey = to.meta.resourceKey as string | undefined;
  if (requiredResourceKey && !authStore.hasResource(requiredResourceKey)) {
    ElMessage.warning("当前账号无权限访问该页面");
    return "/dashboard";
  }
  return true;
});
