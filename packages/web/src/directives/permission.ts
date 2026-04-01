import type { App, Directive, DirectiveBinding } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * v-permission directive
 * Usage: v-permission="'system:user:query'" or v-permission="['system:user:query', 'system:user:create']"
 * Element is removed from DOM if user lacks the required permission(s).
 */
export const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const authStore = useAuthStore()
    const required = binding.value

    if (!required) return

    const permissions = authStore.permissions

    // Super admin bypass
    if (permissions.includes('*:*')) return

    const codes = Array.isArray(required) ? required : [required]
    const hasPermission = codes.some((code) => permissions.includes(code))

    if (!hasPermission) {
      el.parentNode?.removeChild(el)
    }
  },
}

export function registerPermissionDirective(app: App) {
  app.directive('permission', permissionDirective)
}
