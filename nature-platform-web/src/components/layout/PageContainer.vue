<!--
@input Routed page slot content from app shell workspace
@output Main workspace container that guarantees minimum viewport height and background layering order
@position Inner layout wrapper between topbar and routed business pages
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <section class="page-container">
    <slot />
  </section>
</template>

<style scoped>
.page-container {
  min-height: calc(100vh - var(--np-topbar-height));
  position: relative;
  z-index: 1;
}
</style>
