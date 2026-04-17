import { useAuthStore } from '@/stores/auth'

/**
 * Composable for checking user permissions in script setup.
 *
 * Usage:
 *   const { hasPermission } = usePermission()
 *   if (hasPermission('system:user:create')) { ... }
 */
export function usePermission() {
  const authStore = useAuthStore()

  function isSuperAdmin(): boolean {
    return authStore.permissions.includes('*:*')
  }

  function hasPermission(code: string): boolean {
    return isSuperAdmin() || authStore.permissions.includes(code)
  }

  function hasAnyPermission(codes: string[]): boolean {
    return isSuperAdmin() || codes.some((code) => authStore.permissions.includes(code))
  }

  return {
    hasPermission,
    hasAnyPermission,
  }
}
