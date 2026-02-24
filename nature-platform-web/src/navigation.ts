/**
 * @input Route path constants and Element Plus icon components
 * @output Unified navigation metadata for sidebar rendering and route title resolution
 * @position Frontend information-architecture source used by app shell and router
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

export type NavGroup = "总览" | "业务流程" | "报告与归档" | "系统";

export interface NavItem {
  path: string;
  label: string;
  icon: Component;
  group: NavGroup;
  order: number;
}

export const navGroups: readonly NavGroup[] = ["总览", "业务流程", "报告与归档", "系统"] as const;

export const navItems: NavItem[] = [
  { path: "/dashboard", label: "仪表盘", icon: DataBoard, group: "总览", order: 10 },
  { path: "/workflow", label: "待办审批", icon: List, group: "总览", order: 20 },

  { path: "/customers", label: "客户管理", icon: User, group: "业务流程", order: 100 },
  { path: "/contracts", label: "合同管理", icon: Document, group: "业务流程", order: 110 },
  { path: "/project-registers", label: "项目登记", icon: Management, group: "业务流程", order: 120 },
  { path: "/police-registers", label: "公安登记", icon: OfficeBuilding, group: "业务流程", order: 130 },
  { path: "/on-site-assessments", label: "现场测评", icon: Connection, group: "业务流程", order: 140 },
  { path: "/quality-reviews", label: "质量审核", icon: CircleCheck, group: "业务流程", order: 150 },

  { path: "/report-tech-reviews", label: "技术审核", icon: Checked, group: "报告与归档", order: 200 },
  { path: "/report-content-reviews", label: "内容审核", icon: Checked, group: "报告与归档", order: 210 },
  { path: "/report-compile-assignments", label: "编制分配", icon: Tickets, group: "报告与归档", order: 220 },
  { path: "/report-compile-submissions", label: "报告编制", icon: EditPen, group: "报告与归档", order: 230 },
  { path: "/report-final-reviews", label: "最终审核", icon: CircleCheck, group: "报告与归档", order: 240 },
  { path: "/material-archives", label: "材料归档", icon: FolderChecked, group: "报告与归档", order: 250 },

  { path: "/recycle-bin", label: "回收站", icon: Delete, group: "系统", order: 300 }
];

export const groupedNavItems: Record<NavGroup, NavItem[]> = navGroups.reduce((acc, group) => {
  acc[group] = navItems.filter((item) => item.group === group).sort((a, b) => a.order - b.order);
  return acc;
}, {} as Record<NavGroup, NavItem[]>);

export function resolveNavItem(path: string): NavItem | undefined {
  return navItems.find((item) => path === item.path || path.startsWith(`${item.path}/`));
}
