<script setup lang="ts">
defineProps<{ items: string[] }>()
</script>

<template>
  <aside class="chapter-deliverables" aria-label="本章交付物">
    <h2>本章交付物</h2>
    <ul><li v-for="item in items" :key="item">{{ item }}</li></ul>
  </aside>
</template>
