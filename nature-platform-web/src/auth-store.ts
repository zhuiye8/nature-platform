/**
 * @input Pinia defineStore; localStorage for token persistence
 * @output useAuthStore() state and actions for session token/roles lifecycle
 * @position Frontend session state layer shared by route guards and API interceptors
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { defineStore } from "pinia";

const TOKEN_KEY = "nature-platform-token";
const ROLE_KEY = "nature-platform-roles";

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

export const useAuthStore = defineStore("auth-store", {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || "",
    username: "",
    roles: loadRoles()
  }),
  actions: {
    setSession(token: string, username: string, roles: string[] = this.roles) {
      this.token = token;
      this.username = username;
      this.roles = roles;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, JSON.stringify(roles));
    },
    setRoles(roles: string[]) {
      this.roles = Array.isArray(roles) ? roles : [];
      localStorage.setItem(ROLE_KEY, JSON.stringify(this.roles));
    },
    clearSession() {
      this.token = "";
      this.username = "";
      this.roles = [];
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ROLE_KEY);
    }
  }
});
