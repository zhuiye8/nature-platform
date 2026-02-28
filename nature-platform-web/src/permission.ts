/**
 * @input Auth store resource state and Vue directive binding values (兼容历史 permission code)
 * @output hasResource()/hasPermission() helpers with v-resource/v-permission directives for unified visibility control
 * @position Frontend authorization utility layer shared by route guards, menus, and view templates
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import type { Directive, DirectiveBinding } from "vue";
import { useAuthStore } from "./auth-store";
import { resolveResourceKey } from "./resource-mapping";

export type PermissionBindingValue =
  | string
  | string[]
  | {
      anyOf?: string[];
      allOf?: string[];
    };

function canAccess(value: PermissionBindingValue): boolean {
  const authStore = useAuthStore();
  if (typeof value === "string") {
    return authStore.hasResource(resolveResourceKey(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => authStore.hasResource(resolveResourceKey(item)));
  }
  if (value && typeof value === "object") {
    const allOf = Array.isArray(value.allOf) ? value.allOf : [];
    const anyOf = Array.isArray(value.anyOf) ? value.anyOf : [];
    const passAll =
      allOf.length === 0 || allOf.every((item) => authStore.hasResource(resolveResourceKey(item)));
    const passAny =
      anyOf.length === 0 || anyOf.some((item) => authStore.hasResource(resolveResourceKey(item)));
    return passAll && passAny;
  }
  return false;
}

function applyVisibility(el: HTMLElement, binding: DirectiveBinding<PermissionBindingValue>) {
  const allowed = canAccess(binding.value);
  if (!(el as { __npDisplay?: string }).__npDisplay) {
    (el as { __npDisplay?: string }).__npDisplay = el.style.display;
  }
  if (allowed) {
    el.style.display = (el as { __npDisplay?: string }).__npDisplay || "";
    return;
  }
  el.style.display = "none";
}

export function hasPermission(required: string | string[]): boolean {
  const authStore = useAuthStore();
  if (Array.isArray(required)) {
    return required.some((item) => authStore.hasResource(resolveResourceKey(item)));
  }
  return authStore.hasResource(resolveResourceKey(required));
}

export function hasResource(required: string | string[]): boolean {
  return useAuthStore().hasResource(required);
}

export function hasAllPermissions(required: string[]): boolean {
  const authStore = useAuthStore();
  return required.every((item) => authStore.hasResource(resolveResourceKey(item)));
}

export function hasAllResources(required: string[]): boolean {
  return useAuthStore().hasAllResources(required);
}

export const permissionDirective: Directive<HTMLElement, PermissionBindingValue> = {
  mounted(el, binding) {
    applyVisibility(el, binding);
  },
  updated(el, binding) {
    applyVisibility(el, binding);
  }
};

export const resourceDirective: Directive<HTMLElement, PermissionBindingValue> = {
  mounted(el, binding) {
    applyVisibility(el, binding);
  },
  updated(el, binding) {
    applyVisibility(el, binding);
  }
};
