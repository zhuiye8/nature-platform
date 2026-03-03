/**
 * @input Pinia defineStore and localStorage session cache; legacy permission codes mapped to page-level resources
 * @output useAuthStore() state/actions for token/display-name/roles/resources/menu lifecycle and compatibility permission helpers
 * @position Frontend session state layer shared by route guards, sidebar rendering, and permission/resource directives
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { defineStore } from "pinia";
import type { MenuTreeNode } from "./auth-service";
import { resolveResourceKey } from "./resource-mapping";

const TOKEN_KEY = "nature-platform-token";
const ROLE_KEY = "nature-platform-roles";
const RESOURCE_KEY = "nature-platform-resources";
const MENU_TREE_KEY = "nature-platform-menu-tree";
const DISPLAY_NAME_KEY = "nature-platform-display-name";
const MUST_CHANGE_PASSWORD_KEY = "nature-platform-must-change-password";

function loadRoles(): string[] {
  const raw = localStorage.getItem(ROLE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }
  return [];
}

function loadResources(): string[] {
  const raw = localStorage.getItem(RESOURCE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }
  return [];
}

function loadMenuTree(): MenuTreeNode[] {
  const raw = localStorage.getItem(MENU_TREE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as MenuTreeNode[];
    }
  } catch {
    return [];
  }
  return [];
}

function loadMustChangePassword(): boolean {
  const raw = localStorage.getItem(MUST_CHANGE_PASSWORD_KEY);
  return raw === "1";
}

export const useAuthStore = defineStore("auth-store", {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || "",
    username: "",
    displayName: localStorage.getItem(DISPLAY_NAME_KEY) || "",
    mustChangePassword: loadMustChangePassword(),
    roles: loadRoles(),
    resources: loadResources(),
    menuTree: loadMenuTree()
  }),
  actions: {
    setSession(
      token: string,
      username: string,
      displayName: string = this.displayName || username,
      roles: string[] = this.roles,
      resources: string[] = this.resources,
      menuTree: MenuTreeNode[] = this.menuTree,
      mustChangePassword: boolean = this.mustChangePassword
    ) {
      this.token = token;
      this.username = username;
      this.displayName = displayName;
      this.mustChangePassword = Boolean(mustChangePassword);
      this.roles = roles;
      this.resources = Array.isArray(resources) ? resources : [];
      this.menuTree = Array.isArray(menuTree) ? menuTree : [];
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(DISPLAY_NAME_KEY, this.displayName);
      localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, this.mustChangePassword ? "1" : "0");
      localStorage.setItem(ROLE_KEY, JSON.stringify(roles));
      localStorage.setItem(RESOURCE_KEY, JSON.stringify(this.resources));
      localStorage.setItem(MENU_TREE_KEY, JSON.stringify(this.menuTree));
    },
    setMustChangePassword(value: boolean) {
      this.mustChangePassword = Boolean(value);
      localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, this.mustChangePassword ? "1" : "0");
    },
    setRoles(roles: string[]) {
      this.roles = Array.isArray(roles) ? roles : [];
      localStorage.setItem(ROLE_KEY, JSON.stringify(this.roles));
    },
    setResources(resources: string[]) {
      this.resources = Array.isArray(resources) ? resources : [];
      localStorage.setItem(RESOURCE_KEY, JSON.stringify(this.resources));
    },
    setMenuTree(menuTree: MenuTreeNode[]) {
      this.menuTree = Array.isArray(menuTree) ? menuTree : [];
      localStorage.setItem(MENU_TREE_KEY, JSON.stringify(this.menuTree));
    },
    hasResource(required: string | string[]) {
      if (this.roles.includes("ROLE_SUPER_ADMIN")) {
        return true;
      }
      if (Array.isArray(required)) {
        if (!required.length) {
          return true;
        }
        return required.some((code) => typeof code === "string" && this.resources.includes(code));
      }
      return typeof required === "string" && this.resources.includes(required);
    },
    hasAllResources(required: string[]) {
      if (this.roles.includes("ROLE_SUPER_ADMIN")) {
        return true;
      }
      if (!required.length) {
        return true;
      }
      return required.every((code) => this.resources.includes(code));
    },
    hasPermission(required: string | string[]) {
      if (Array.isArray(required)) {
        if (!required.length) {
          return true;
        }
        return required.some((code) => typeof code === "string" && this.hasResource(resolveResourceKey(code)));
      }
      return typeof required === "string" && this.hasResource(resolveResourceKey(required));
    },
    hasAllPermissions(required: string[]) {
      if (!required.length) {
        return true;
      }
      return required.every((code) => this.hasResource(resolveResourceKey(code)));
    },
    clearSession() {
      this.token = "";
      this.username = "";
      this.displayName = "";
      this.mustChangePassword = false;
      this.roles = [];
      this.resources = [];
      this.menuTree = [];
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(DISPLAY_NAME_KEY);
      localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(RESOURCE_KEY);
      localStorage.removeItem(MENU_TREE_KEY);
    }
  }
});
