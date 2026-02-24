<template>
  <section class="page-container">
    <slot />
  </section>
</template>

<style scoped>
.page-container {
  min-height: calc(100vh - var(--np-topbar-height));
}
</style>