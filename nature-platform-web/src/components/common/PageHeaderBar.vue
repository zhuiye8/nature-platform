<template>
  <header class="page-header-bar">
    <div class="left">
      <slot name="title" />
    </div>
    <div class="right">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 1024px) {
  .page-header-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>