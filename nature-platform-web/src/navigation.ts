/**
 * @input Static route metadata, resource-key conventions, and Element Plus icon components
 * @output Navigation metadata and icon helpers for route-title fallback plus backend menu-tree rendering
 * @position Frontend information-architecture helper for route mapping, sidebar icons, and resource-key binding
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import type { Component } from "vue";
import {
  DataBoard,
  User,
  Document,
  Management,
  OfficeBuilding,
  Connection,
  CircleCheck,
  Checked,
  Tickets,
  EditPen,
  FolderChecked,
  Delete,
  List
} from "@element-plus/icons-vue";
import type { MenuTreeNode } from "./auth-service";

export type NavGroup = "总览" | "业务流程" | "报告与归档" | "系统";

export interface NavItem {
  path: string;
  label: string;
  icon: Component;
  group: NavGroup;
  order: number;
  resourceKey?: string;
}

export const navGroups: readonly NavGroup[] = ["总览", "业务流程", "报告与归档", "系统"] as const;

export const navItems: NavItem[] = [
  { path: "/dashboard", label: "仪表盘", icon: DataBoard, group: "总览", order: 10 },
  { path: "/workflow", label: "待办审批", icon: List, group: "总览", order: 20, resourceKey: "page.workflow" },

  { path: "/customers", label: "客户管理", icon: User, group: "业务流程", order: 100, resourceKey: "page.customers" },
  {
    path: "/contract-submissions",
    label: "合同提审",
    icon: Document,
    group: "业务流程",
    order: 110,
    resourceKey: "page.contract-submissions"
  },
  {
    path: "/contract-archives",
    label: "合同归档",
    icon: FolderChecked,
    group: "业务流程",
    order: 115,
    resourceKey: "page.contract-archives"
  },
  {
    path: "/project-registers",
    label: "项目登记",
    icon: Management,
    group: "业务流程",
    order: 120,
    resourceKey: "page.project-registers"
  },
  {
    path: "/police-registers",
    label: "公安登记",
    icon: OfficeBuilding,
    group: "业务流程",
    order: 130,
    resourceKey: "page.police-registers"
  },
  {
    path: "/on-site-assessment-executions",
    label: "现场测评实施",
    icon: Connection,
    group: "业务流程",
    order: 140,
    resourceKey: "page.on-site-assessment-executions"
  },
  {
    path: "/on-site-assessment-results",
    label: "现场测评结果",
    icon: CircleCheck,
    group: "业务流程",
    order: 145,
    resourceKey: "page.on-site-assessment-results"
  },

  {
    path: "/report-tech-reviews",
    label: "技术审核",
    icon: Checked,
    group: "报告与归档",
    order: 200,
    resourceKey: "page.report-tech-reviews"
  },
  {
    path: "/report-content-reviews",
    label: "内容审核",
    icon: Checked,
    group: "报告与归档",
    order: 210,
    resourceKey: "page.report-content-reviews"
  },
  {
    path: "/report-compile-assignments",
    label: "编制分配",
    icon: Tickets,
    group: "报告与归档",
    order: 220,
    resourceKey: "page.report-compile-assignments"
  },
  {
    path: "/report-compile-submissions",
    label: "报告编制",
    icon: EditPen,
    group: "报告与归档",
    order: 230,
    resourceKey: "page.report-compile-submissions"
  },
  {
    path: "/report-final-reviews",
    label: "最终审核",
    icon: CircleCheck,
    group: "报告与归档",
    order: 240,
    resourceKey: "page.report-final-reviews"
  },
  {
    path: "/material-archives",
    label: "材料归档",
    icon: FolderChecked,
    group: "报告与归档",
    order: 250,
    resourceKey: "page.material-archives"
  },

  { path: "/admin-users", label: "用户管理", icon: User, group: "系统", order: 300, resourceKey: "page.admin-users" },
  {
    path: "/admin-departments",
    label: "部门管理",
    icon: OfficeBuilding,
    group: "系统",
    order: 305,
    resourceKey: "page.admin-departments"
  },
  { path: "/admin-roles", label: "角色管理", icon: Management, group: "系统", order: 310, resourceKey: "page.admin-roles" },
  {
    path: "/admin-resources",
    label: "资源管理",
    icon: Checked,
    group: "系统",
    order: 320,
    resourceKey: "page.admin-resources"
  },
  {
    path: "/admin-workflow",
    label: "流程管理",
    icon: Connection,
    group: "系统",
    order: 330,
    resourceKey: "page.admin-workflow"
  },
  {
    path: "/admin-audit-logs",
    label: "审计日志",
    icon: List,
    group: "系统",
    order: 340,
    resourceKey: "page.admin-audit-logs"
  },
  {
    path: "/recycle-bin",
    label: "回收站",
    icon: Delete,
    group: "系统",
    order: 350,
    resourceKey: "page.recycle-bin"
  }
];

export const groupedNavItems: Record<NavGroup, NavItem[]> = navGroups.reduce((acc, group) => {
  acc[group] = navItems.filter((item) => item.group === group).sort((a, b) => a.order - b.order);
  return acc;
}, {} as Record<NavGroup, NavItem[]>);

export function resolveNavItem(path: string): NavItem | undefined {
  return navItems.find((item) => path === item.path || path.startsWith(`${item.path}/`));
}

const iconMap: Record<string, Component> = {
  DataBoard,
  User,
  Document,
  Management,
  OfficeBuilding,
  Connection,
  CircleCheck,
  Checked,
  Tickets,
  EditPen,
  FolderChecked,
  Delete,
  List
};

export function resolveNavIcon(iconName?: string): Component {
  if (!iconName) {
    return List;
  }
  return iconMap[iconName] || List;
}

export interface RuntimeMenuGroup {
  groupKey: string;
  groupLabel: string;
  children: Array<{
    path: string;
    label: string;
    icon: Component;
    resourceKey: string;
    order: number;
  }>;
}

export function buildRuntimeMenuGroups(menuTree: MenuTreeNode[]): RuntimeMenuGroup[] {
  if (!Array.isArray(menuTree) || menuTree.length === 0) {
    return navGroups.map((groupName) => ({
      groupKey: groupName,
      groupLabel: groupName,
      children: groupedNavItems[groupName].map((item) => ({
        path: item.path,
        label: item.label,
        icon: item.icon,
        resourceKey: item.resourceKey || "",
        order: item.order
      }))
    }));
  }

  const groups: RuntimeMenuGroup[] = [];
  for (const groupNode of menuTree) {
    const children = (groupNode.children || [])
      .filter((item) => item.resourceType === "PAGE" && item.routePath)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        path: item.routePath as string,
        label: item.resourceName,
        icon: resolveNavIcon(item.icon),
        resourceKey: item.resourceKey,
        order: item.sortOrder
      }));
    if (children.length === 0) {
      continue;
    }
    groups.push({
      groupKey: groupNode.resourceKey,
      groupLabel: groupNode.resourceName,
      children
    });
  }
  return groups;
}
