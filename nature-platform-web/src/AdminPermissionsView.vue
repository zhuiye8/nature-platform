<template>
  <AdminResourcesView />
</template>

<script setup lang="ts">
/**
 * @input AdminResourcesView page component
 * @output Legacy admin-permissions view compatibility wrapper that delegates to resource management page
 * @position Transitional compatibility layer to prevent broken imports while RBAC permission->resource migration stabilizes
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import AdminResourcesView from "./AdminResourcesView.vue";
</script>
