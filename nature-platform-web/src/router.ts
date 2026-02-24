/**
 * @input vue-router APIs, auth store token state, and centralized navigation metadata
 * @output Router instance with auth guard, route-level lazy loading, and title metadata derived from navigation config
 * @position Frontend navigation layer enforcing authenticated access and synchronizing route/menu information architecture
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "./auth-store";
import { navItems } from "./navigation";

const viewMap: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("./DashboardView.vue"),
  "/workflow": () => import("./WorkflowView.vue"),
  "/customers": () => import("./CustomersView.vue"),
  "/contracts": () => import("./ContractsView.vue"),
  "/project-registers": () => import("./ProjectRegistersView.vue"),
  "/police-registers": () => import("./PoliceRegistersView.vue"),
  "/on-site-assessments": () => import("./OnSiteAssessmentsView.vue"),
  "/quality-reviews": () => import("./QualityReviewsView.vue"),
  "/report-tech-reviews": () => import("./ReportTechReviewsView.vue"),
  "/report-content-reviews": () => import("./ReportContentReviewsView.vue"),
  "/report-compile-assignments": () => import("./ReportCompileAssignmentsView.vue"),
  "/report-compile-submissions": () => import("./ReportCompileSubmissionsView.vue"),
  "/report-final-reviews": () => import("./ReportFinalReviewsView.vue"),
  "/material-archives": () => import("./MaterialArchivesView.vue"),
  "/recycle-bin": () => import("./RecycleBinView.vue")
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
        title: item.label
      }
    } as RouteRecordRaw;
  })
  .filter((item): item is RouteRecordRaw => item !== null);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("./LoginView.vue"), meta: { public: true, title: "登录" } },
    { path: "/", redirect: "/dashboard" },
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
  return true;
});