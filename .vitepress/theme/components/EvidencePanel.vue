<script setup lang="ts">
defineProps<{ title?: string; conclusion: string; source?: string }>()
</script>

<template>
  <aside class="evidence-panel" aria-label="证据面板">
    <strong>{{ title || '证据' }}</strong>
    <div class="evidence-panel__body"><slot /></div>
    <p><b>对应判断：</b>{{ conclusion }}</p>
    <small v-if="source">来源：{{ source }}</small>
  </aside>
</template>
